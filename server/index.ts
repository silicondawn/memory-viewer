/**
 * Memory Viewer — API Server
 *
 * Provides REST endpoints for browsing, reading, editing, and searching
 * Markdown files, plus a WebSocket channel that pushes live file-change
 * notifications to connected clients.
 */
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import os from "os";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { watch } from "chokidar";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT) || 3001;
const WORKSPACE = process.env.WORKSPACE_DIR || path.join(os.homedir(), "clawd");
const STATIC_DIR = process.env.STATIC_DIR || path.join(import.meta.dirname, "..", "dist");

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: "*" }));
app.use(express.json());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve and validate a relative .md path inside the workspace. */
function safePath(filePath: string | undefined | null): string | null {
  if (!filePath || filePath.includes("..") || !filePath.endsWith(".md")) return null;
  const full = path.resolve(WORKSPACE, filePath);
  if (!full.startsWith(path.resolve(WORKSPACE))) return null;
  return full;
}

/** Recursively scan a directory for .md files and return a tree structure. */
interface TreeNode {
  name: string;
  type: "file" | "dir";
  path: string;
  children?: TreeNode[];
}

function scanDir(dir: string, prefix = ""): TreeNode[] {
  const result: TreeNode[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      const children = scanDir(path.join(dir, entry.name), relPath);
      if (children.length > 0) {
        result.push({ name: entry.name, type: "dir", path: relPath, children });
      }
    } else if (entry.name.endsWith(".md")) {
      result.push({ name: entry.name, type: "file", path: relPath });
    }
  }
  return result;
}

/** Collect all .md file paths (flat list). */
function collectMdFiles(dir: string, prefix = ""): string[] {
  const files: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...collectMdFiles(path.join(dir, entry.name), relPath));
    } else if (entry.name.endsWith(".md")) {
      files.push(relPath);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------

/** List all .md files as a tree. */
app.get("/api/files", (_req, res) => {
  res.json(scanDir(WORKSPACE));
});

/** Read a single file. */
app.get("/api/file", (req, res) => {
  const full = safePath(req.query.path as string);
  if (!full) return void res.status(400).json({ error: "Invalid path" });
  if (!fs.existsSync(full)) return void res.status(404).json({ error: "Not found" });
  const content = fs.readFileSync(full, "utf-8");
  const stat = fs.statSync(full);
  res.json({ content, mtime: stat.mtime, size: stat.size });
});

/** Save a file. */
app.put("/api/file", (req, res) => {
  const { path: filePath, content } = req.body;
  const full = safePath(filePath);
  if (!full) return void res.status(400).json({ error: "Invalid path" });
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf-8");
  const stat = fs.statSync(full);
  res.json({ ok: true, mtime: stat.mtime });
});

/** Full-text search across all .md files. */
app.get("/api/search", (req, res) => {
  const q = (req.query.q as string || "").trim().toLowerCase();
  if (!q || q.length < 2) return void res.json([]);

  const files = collectMdFiles(WORKSPACE);
  const results: { path: string; matches: { line: number; text: string }[] }[] = [];

  for (const relPath of files) {
    const full = path.join(WORKSPACE, relPath);
    let content: string;
    try {
      content = fs.readFileSync(full, "utf-8");
    } catch {
      continue;
    }
    const lines = content.split("\n");
    const matches: { line: number; text: string }[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(q)) {
        matches.push({ line: i + 1, text: lines[i].substring(0, 200) });
        if (matches.length >= 5) break; // cap per file
      }
    }
    if (matches.length > 0) {
      results.push({ path: relPath, matches });
    }
    if (results.length >= 50) break; // cap total
  }
  res.json(results);
});

/** Recently modified files. */
app.get("/api/recent", (_req, res) => {
  const files = collectMdFiles(WORKSPACE);
  const withStats = files.map((relPath) => {
    const full = path.join(WORKSPACE, relPath);
    try {
      const stat = fs.statSync(full);
      return { path: relPath, mtime: stat.mtime.getTime(), size: stat.size };
    } catch {
      return null;
    }
  }).filter(Boolean) as { path: string; mtime: number; size: number }[];
  withStats.sort((a, b) => b.mtime - a.mtime);
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  res.json(withStats.slice(0, limit));
});

/** Monthly file count distribution for memory/ directory. */
app.get("/api/stats/monthly", (_req, res) => {
  const memoryDir = path.join(WORKSPACE, "memory");
  const counts: Record<string, number> = {};
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(memoryDir, { withFileTypes: true });
  } catch {
    return void res.json([]);
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    // Try to extract YYYY-MM from filename like 2025-01-15.md
    const match = entry.name.match(/^(\d{4}-\d{2})/);
    if (match) {
      counts[match[1]] = (counts[match[1]] || 0) + 1;
    } else {
      // Use file mtime
      try {
        const stat = fs.statSync(path.join(memoryDir, entry.name));
        const month = stat.mtime.toISOString().slice(0, 7);
        counts[month] = (counts[month] || 0) + 1;
      } catch { /* skip */ }
    }
  }
  const result = Object.entries(counts)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
  res.json(result);
});

/** Bot identity info — reads from SOUL.md or IDENTITY.md. */
app.get("/api/info", (_req, res) => {
  let name = "Unknown Bot";
  let description = "";
  for (const fname of ["IDENTITY.md", "SOUL.md"]) {
    const fpath = path.join(WORKSPACE, fname);
    if (fs.existsSync(fpath)) {
      const content = fs.readFileSync(fpath, "utf-8");
      // Try to extract name from first heading
      const heading = content.match(/^#\s+(.+)/m);
      if (heading) name = heading[1].trim();
      // First paragraph as description
      const lines = content.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
      if (lines.length > 0) description = lines[0].trim().substring(0, 200);
      break;
    }
  }
  res.json({ name, version: "1.0.0", description });
});

/** System status. */
app.get("/api/system", (_req, res) => {
  const uptime = os.uptime();
  const memTotal = os.totalmem();
  const memFree = os.freemem();
  const load = os.loadavg();
  const platform = `${os.platform()} ${os.release()}`;
  const hostname = os.hostname();

  const today = new Date().toISOString().split("T")[0];
  const todayPath = path.join(WORKSPACE, "memory", `${today}.md`);
  let todayMemory = null;
  if (fs.existsSync(todayPath)) {
    const content = fs.readFileSync(todayPath, "utf-8");
    todayMemory = {
      filename: `memory/${today}.md`,
      snippet: content.split("\n").slice(0, 10).join("\n"),
      length: content.length,
    };
  }

  // Count total files
  const totalFiles = collectMdFiles(WORKSPACE).length;

  res.json({
    uptime, memTotal, memFree, memUsed: memTotal - memFree,
    load, platform, hostname, todayMemory, totalFiles,
  });
});

// ---------------------------------------------------------------------------
// Gateway Chat Proxy (avoid CORS for frontend)
// ---------------------------------------------------------------------------
app.post("/api/gateway/chat", async (req, res) => {
  const { gatewayUrl, token, messages } = req.body;
  if (!gatewayUrl || !token || !messages) {
    return void res.status(400).json({ error: "Missing gatewayUrl, token, or messages" });
  }
  try {
    const url = `${gatewayUrl.replace(/\/+$/, "")}/v1/chat/completions`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ model: "default", messages }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return void res.status(resp.status).json({ error: text });
    }
    const data = await resp.json();
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || "Gateway request failed" });
  }
});

// ---------------------------------------------------------------------------
// Static file serving (production)
// ---------------------------------------------------------------------------
if (fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(STATIC_DIR, "index.html"));
  });
}

// ---------------------------------------------------------------------------
// WebSocket — live file change notifications
// ---------------------------------------------------------------------------
const wss = new WebSocketServer({ server, path: "/ws" });

function broadcast(data: object) {
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

const watcher = watch(path.join(WORKSPACE, "**/*.md"), {
  ignoreInitial: true,
  ignored: /(^|[/\\])\.(git|node_modules)/,
  awaitWriteFinish: { stabilityThreshold: 300 },
});

watcher.on("all", (event, filePath) => {
  const rel = path.relative(WORKSPACE, filePath);
  broadcast({ type: "file-change", event, path: rel });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
server.listen(PORT, "0.0.0.0", () => {
  console.log(`📝 Memory Viewer running at http://localhost:${PORT}`);
  console.log(`📂 Workspace: ${WORKSPACE}`);
});
