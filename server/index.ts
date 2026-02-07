/**
 * Memory Viewer — API Server (Hono)
 *
 * Provides REST endpoints for browsing, reading, editing, and searching
 * Markdown files, plus a WebSocket channel that pushes live file-change
 * notifications to connected clients.
 */
import { Hono } from "hono";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { createNodeWebSocket } from "@hono/node-ws";
import { serve } from "@hono/node-server";
import fs from "fs";
import path from "path";
import os from "os";
import { exec as execCallback } from "child_process";
import util from "util";
import { watch } from "chokidar";
import type { ServerWebSocket } from "@hono/node-ws";

const exec = util.promisify(execCallback);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT) || 3001;
const WORKSPACE = process.env.WORKSPACE_DIR || path.join(os.homedir(), "clawd");
const STATIC_DIR = process.env.STATIC_DIR || path.join(import.meta.dirname, "..", "dist");

const app = new Hono();
export { app }; // Export for testing
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use("*", compress());
app.use("*", cors({ origin: "*" }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safePath(filePath: string | undefined | null): string | null {
  if (!filePath || filePath.includes("..") || !filePath.endsWith(".md")) return null;
  const full = path.resolve(WORKSPACE, filePath);
  if (!full.startsWith(path.resolve(WORKSPACE))) return null;
  return full;
}

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

app.get("/api/skills", (c) => {
  const skillsDir = path.join(WORKSPACE, "skills");
  const results: { id: string; name: string; description: string; path: string }[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  } catch {
    return c.json([]);
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const skillMd = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillMd)) continue;
    const content = fs.readFileSync(skillMd, "utf-8");
    let name = entry.name;
    let description = "";
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const nameMatch = fmMatch[1].match(/^name:\s*(.+)/m);
      const descMatch = fmMatch[1].match(/^description:\s*(.+)/m);
      if (nameMatch) name = nameMatch[1].trim().replace(/^["']|["']$/g, "");
      if (descMatch) description = descMatch[1].trim().replace(/^["']|["']$/g, "");
    }
    results.push({ id: entry.name, name, description, path: `skills/${entry.name}/SKILL.md` });
  }
  return c.json(results);
});

app.get("/api/files", (c) => c.json(scanDir(WORKSPACE)));

app.get("/api/file", (c) => {
  const full = safePath(c.req.query("path"));
  if (!full) return c.json({ error: "Invalid path" }, 400);
  if (!fs.existsSync(full)) return c.json({ error: "Not found" }, 404);
  const content = fs.readFileSync(full, "utf-8");
  const stat = fs.statSync(full);
  return c.json({ content, mtime: stat.mtime, size: stat.size });
});

app.put("/api/file", async (c) => {
  const { path: filePath, content, expectedMtime } = await c.req.json();
  const full = safePath(filePath);
  if (!full) return c.json({ error: "Invalid path" }, 400);

  if (expectedMtime && fs.existsSync(full)) {
    const currentMtime = fs.statSync(full).mtime.toISOString();
    if (currentMtime !== expectedMtime) {
      const currentContent = fs.readFileSync(full, "utf-8");
      return c.json({
        error: "conflict",
        message: "File was modified since you started editing",
        serverMtime: currentMtime,
        serverContent: currentContent,
      }, 409);
    }
  }

  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf-8");
  const stat = fs.statSync(full);
  return c.json({ ok: true, mtime: stat.mtime });
});

// ---------------------------------------------------------------------------
// Backlinks API
// ---------------------------------------------------------------------------
app.get("/api/backlinks", (c) => {
  const targetPath = (c.req.query("path") || "").trim();
  if (!targetPath) return c.json({ error: "Missing path parameter" }, 400);

  // Derive possible match targets from the given path
  // e.g. "MEMORY.md" -> match [[MEMORY]], "memory/2026-02-01.md" -> match [[memory/2026-02-01]]
  const withoutExt = targetPath.replace(/\.md$/, "");
  const baseName = path.basename(withoutExt); // just filename without dirs

  const allFiles = collectMdFiles(WORKSPACE);
  const results: { path: string; line: number; context: string }[] = [];

  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;

  for (const relPath of allFiles) {
    // Don't include self-references
    if (relPath === targetPath) continue;

    const full = path.join(WORKSPACE, relPath);
    let content: string;
    try {
      content = fs.readFileSync(full, "utf-8");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      let match;
      wikiLinkRegex.lastIndex = 0;
      while ((match = wikiLinkRegex.exec(lines[i])) !== null) {
        const linkTarget = match[1].trim();
        // Match if:
        // 1. Exact path match (without .md): [[memory/2026-02-01]] matches memory/2026-02-01.md
        // 2. Filename-only match: [[MEMORY]] matches MEMORY.md, [[infra]] matches memory/infra.md
        if (
          linkTarget === withoutExt ||
          linkTarget.toLowerCase() === withoutExt.toLowerCase() ||
          linkTarget === baseName ||
          linkTarget.toLowerCase() === baseName.toLowerCase()
        ) {
          results.push({
            path: relPath,
            line: i + 1,
            context: lines[i].substring(0, 200),
          });
          break; // one match per line is enough
        }
      }
    }
  }

  return c.json(results);
});

app.get("/api/resolve-wikilink", (c) => {
  const link = (c.req.query("link") || "").trim();
  if (!link) return c.json({ error: "Missing link parameter" }, 400);

  const allFiles = collectMdFiles(WORKSPACE);

  // Try exact path match first
  const exactPath = link.endsWith(".md") ? link : `${link}.md`;
  if (allFiles.includes(exactPath)) {
    return c.json({ found: true, path: exactPath });
  }

  // Try case-insensitive exact path
  const exactLower = exactPath.toLowerCase();
  const ciMatch = allFiles.find((f) => f.toLowerCase() === exactLower);
  if (ciMatch) {
    return c.json({ found: true, path: ciMatch });
  }

  // Try filename-only match (fuzzy)
  const linkLower = link.toLowerCase();
  const byName = allFiles.find((f) => {
    const name = path.basename(f, ".md");
    return name.toLowerCase() === linkLower;
  });
  if (byName) {
    return c.json({ found: true, path: byName });
  }

  return c.json({ found: false, path: null });
});

app.get("/api/search", (c) => {
  const q = (c.req.query("q") || "").trim().toLowerCase();
  if (!q || q.length < 2) return c.json([]);

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
        if (matches.length >= 5) break;
      }
    }
    if (matches.length > 0) results.push({ path: relPath, matches });
    if (results.length >= 50) break;
  }
  return c.json(results);
});

app.get("/api/recent", (c) => {
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
  const limit = Math.min(Number(c.req.query("limit")) || 10, 50);
  return c.json(withStats.slice(0, limit));
});

app.get("/api/stats/monthly", (c) => {
  const memoryDir = path.join(WORKSPACE, "memory");
  const counts: Record<string, number> = {};
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(memoryDir, { withFileTypes: true });
  } catch {
    return c.json([]);
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const match = entry.name.match(/^(\d{4}-\d{2})/);
    if (match) {
      counts[match[1]] = (counts[match[1]] || 0) + 1;
    } else {
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
  return c.json(result);
});

app.get("/api/stats/daily", (c) => {
  const memoryDir = path.join(WORKSPACE, "memory");
  const results: { date: string; count: number; size: number }[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(memoryDir, { withFileTypes: true });
  } catch {
    return c.json([]);
  }
  const dateMap = new Map<string, { count: number; size: number }>();
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const match = entry.name.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!match) continue;
    const date = match[1];
    try {
      const stat = fs.statSync(path.join(memoryDir, entry.name));
      const existing = dateMap.get(date);
      if (existing) {
        existing.count++;
        existing.size += stat.size;
      } else {
        dateMap.set(date, { count: 1, size: stat.size });
      }
    } catch { /* skip */ }
  }
  for (const [date, val] of dateMap) {
    results.push({ date, count: val.count, size: val.size });
  }
  results.sort((a, b) => a.date.localeCompare(b.date));
  return c.json(results);
});

app.get("/api/info", (c) => {
  let name = "Unknown Bot";
  let description = "";
  for (const fname of ["IDENTITY.md", "SOUL.md"]) {
    const fpath = path.join(WORKSPACE, fname);
    if (fs.existsSync(fpath)) {
      const content = fs.readFileSync(fpath, "utf-8");
      const heading = content.match(/^#\s+(.+)/m);
      if (heading) name = heading[1].trim();
      const lines = content.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
      if (lines.length > 0) description = lines[0].trim().substring(0, 200);
      break;
    }
  }
  return c.json({ name, version: "1.0.0", description });
});

app.get("/api/system", (c) => {
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

  const totalFiles = collectMdFiles(WORKSPACE).length;

  return c.json({
    uptime, memTotal, memFree, memUsed: memTotal - memFree,
    load, platform, hostname, todayMemory, totalFiles,
  });
});

app.get("/api/agent/status", async (c) => {
  // 1. Config
  const home = os.homedir();
  const configPath = path.join(home, ".openclaw", "openclaw.json");
  let safeConfig: any = {};
  try {
    if (fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      // Whitelist specific fields
      safeConfig = {
        version: raw.version,
        update: raw.update,
        models: { mode: raw.models?.mode },
        agents: { defaults: raw.agents?.defaults },
        gateway: {
          port: raw.gateway?.port,
          mode: raw.gateway?.mode,
        },
      };
    }
  } catch (e) {
    console.error("Failed to read config", e);
    safeConfig = { error: "Could not read config" };
  }

  // 2. Gateway Status
  let gatewayStatus = null;
  try {
    const { stdout } = await exec("openclaw gateway status --json");
    gatewayStatus = JSON.parse(stdout);
  } catch (e) {
    // console.error("Failed to get gateway status", e);
    // fallback or null
  }

  // 3. Heartbeat
  let heartbeat = null;
  try {
    const hbPath = path.join(WORKSPACE, "memory", "heartbeat-state.json");
    if (fs.existsSync(hbPath)) {
      heartbeat = JSON.parse(fs.readFileSync(hbPath, "utf-8"));
    }
  } catch (e) {
    console.error("Failed to read heartbeat", e);
  }

  return c.json({
    config: safeConfig,
    gateway: gatewayStatus,
    heartbeat
  });
});

// ---------------------------------------------------------------------------
// Gateway Chat Proxy
// ---------------------------------------------------------------------------
app.post("/api/gateway/chat", async (c) => {
  const { gatewayUrl, token, messages } = await c.req.json();
  if (!gatewayUrl || !token || !messages) {
    return c.json({ error: "Missing gatewayUrl, token, or messages" }, 400);
  }
  try {
    const url = `${gatewayUrl.replace(/\/+$/, "")}/v1/chat/completions`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ model: "default", messages }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const text = await resp.text();
      return c.json({ error: text }, resp.status as any);
    }
    const data = await resp.json();
    return c.json(data);
  } catch (err: any) {
    if (err.name === "AbortError") {
      return c.json({ error: "Gateway request timeout (30s)" }, 504);
    }
    return c.json({ error: err.message || "Gateway request failed" }, 502);
  }
});

// ---------------------------------------------------------------------------
// AI Summarize
// ---------------------------------------------------------------------------
const GATEWAY_CHAT_URL = process.env.GATEWAY_CHAT_URL || "http://silicon-01:3001/v1/chat/completions";
const SUMMARIZE_MODEL = process.env.SUMMARIZE_MODEL || "kimi-k2.5";

app.post("/api/summarize", async (c) => {
  const { path: filePath, content: providedContent, save } = await c.req.json();
  const full = safePath(filePath);
  if (!full) return c.json({ error: "Invalid path" }, 400);

  let content = providedContent;
  if (!content) {
    if (!fs.existsSync(full)) return c.json({ error: "Not found" }, 404);
    content = fs.readFileSync(full, "utf-8");
  }

  // Strip existing frontmatter for summarization
  const bodyMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
  const body = bodyMatch ? bodyMatch[1] : content;

  if (body.trim().length < 50) {
    return c.json({ error: "Content too short to summarize" }, 400);
  }

  try {
    const resp = await fetch(GATEWAY_CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: SUMMARIZE_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a concise summarizer. Given a markdown document, produce a brief summary (1-3 sentences, max 200 chars). Reply with ONLY the summary text, no quotes, no prefix.",
          },
          { role: "user", content: body.slice(0, 8000) },
        ],
        max_tokens: 256,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return c.json({ error: `Gateway error: ${text}` }, 502);
    }

    const data: any = await resp.json();
    const summary = (data.choices?.[0]?.message?.content || "").trim();
    if (!summary) return c.json({ error: "Empty summary returned" }, 502);

    // Optionally save to file frontmatter
    if (save) {
      const existingFm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      let newContent: string;
      if (existingFm) {
        // Update or add summary field in existing frontmatter
        const fmContent = existingFm[1];
        if (/^summary:/m.test(fmContent)) {
          const updatedFm = fmContent.replace(/^summary:.*$/m, `summary: "${summary.replace(/"/g, '\\"')}"`);
          newContent = content.replace(existingFm[0], `---\n${updatedFm}\n---`);
        } else {
          newContent = content.replace(existingFm[0], `---\n${fmContent}\nsummary: "${summary.replace(/"/g, '\\"')}"\n---`);
        }
      } else {
        newContent = `---\nsummary: "${summary.replace(/"/g, '\\"')}"\n---\n${content}`;
      }
      fs.writeFileSync(full, newContent, "utf-8");
      const stat = fs.statSync(full);
      return c.json({ summary, saved: true, mtime: stat.mtime });
    }

    return c.json({ summary, saved: false });
  } catch (err: any) {
    if (err.name === "AbortError" || err.name === "TimeoutError") {
      return c.json({ error: "Gateway timeout (30s)" }, 504);
    }
    return c.json({ error: err.message || "Summarize failed" }, 502);
  }
});

// ---------------------------------------------------------------------------
// WebSocket — live file change notifications
// ---------------------------------------------------------------------------
const wsClients = new Set<ServerWebSocket>();

app.get("/ws", upgradeWebSocket(() => ({
  onOpen(_event, ws) {
    wsClients.add(ws);
  },
  onClose(_event, ws) {
    wsClients.delete(ws);
  },
})));

function broadcast(data: object) {
  const msg = JSON.stringify(data);
  for (const ws of wsClients) {
    try { ws.send(msg); } catch { /* ignore */ }
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
// Workspace assets (images, SVGs, etc.)
// ---------------------------------------------------------------------------
app.get("/workspace-assets/*", async (c) => {
  const assetPath = c.req.path.replace("/workspace-assets/", "");
  const fullPath = path.join(WORKSPACE, "assets", assetPath);
  if (!fullPath.startsWith(path.join(WORKSPACE, "assets"))) {
    return c.json({ error: "Invalid path" }, 403);
  }
  if (!fs.existsSync(fullPath)) {
    return c.json({ error: "Not found" }, 404);
  }
  const ext = path.extname(fullPath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  const contentType = mimeTypes[ext] || "application/octet-stream";
  const content = fs.readFileSync(fullPath);
  c.header("Content-Type", contentType);
  c.header("Cache-Control", "public, max-age=3600");
  return c.body(content);
});

// ---------------------------------------------------------------------------
// Static file serving
// ---------------------------------------------------------------------------
if (fs.existsSync(STATIC_DIR)) {
  app.use("/assets/*", serveStatic({
    root: STATIC_DIR,
    rewriteRequestPath: (p) => p,
  }));
  app.use("*", serveStatic({ root: STATIC_DIR }));
  // SPA fallback
  app.get("*", (c) => {
    const html = fs.readFileSync(path.join(STATIC_DIR, "index.html"), "utf-8");
    c.header("Cache-Control", "no-cache, no-store, must-revalidate");
    return c.html(html);
  });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV !== 'test') {
  const server = serve({ fetch: app.fetch, port: PORT, hostname: "0.0.0.0" }, (info) => {
    console.log(`📝 Memory Viewer running at http://localhost:${info.port}`);
    console.log(`📂 Workspace: ${WORKSPACE}`);
  });
  injectWebSocket(server);
}

