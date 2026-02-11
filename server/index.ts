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
import Database from "better-sqlite3";
import { exec as execCallback } from "child_process";
import util from "util";
import { watch } from "chokidar";
import type { WSContext } from "hono/ws";

const exec = util.promisify(execCallback);

// ---------------------------------------------------------------------------
// Agent Config Types
// ---------------------------------------------------------------------------
interface AgentConfig {
  id: string;
  name: string;
  workspace?: string;
  agentDir?: string;
  identity?: {
    name?: string;
    emoji?: string;
  };
  skills?: string[];
}

interface AgentsConfig {
  defaults: {
    workspace?: string;
  };
  list: AgentConfig[];
}

interface OpenClawConfig {
  agents?: AgentsConfig;
}

interface AgentInfo {
  id: string;
  name: string;
  workspace: string;
  emoji: string;
  skills?: string[];
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
const SETTINGS_DIR = path.join(os.homedir(), ".config", "memory-viewer");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "settings.json");

interface AppSettings {
  embedding: {
    enabled: boolean;
    apiUrl: string;
    apiKey: string;
    model: string;
  };
  pluginsDir: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  embedding: { enabled: false, apiUrl: "", apiKey: "", model: "" },
  pluginsDir: "",
};

function loadSettings(): AppSettings {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(s: AppSettings): void {
  fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2));
}

let appSettings = loadSettings();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT) || 3001;
const DEFAULT_WORKSPACE = process.env.WORKSPACE_DIR || path.join(os.homedir(), "clawd");
const STATIC_DIR = process.env.STATIC_DIR || path.join(import.meta.dirname, "..", "dist");

const app = new Hono();
export { app }; // Export for testing
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use("*", compress());
app.use("*", cors({ origin: "*" }));

// ---------------------------------------------------------------------------
// Agent Management
// ---------------------------------------------------------------------------
const OPENCLAW_CONFIG_PATH = path.join(os.homedir(), ".openclaw", "openclaw.json");

function loadOpenClawConfig(): OpenClawConfig | null {
  try {
    if (fs.existsSync(OPENCLAW_CONFIG_PATH)) {
      const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Failed to load OpenClaw config:", e);
  }
  return null;
}

function getAgentWorkspace(agentConfig: AgentConfig, defaults: { workspace?: string }): string {
  // Priority: workspace > agentDir > defaults.workspace > DEFAULT_WORKSPACE
  if (agentConfig.workspace) {
    return agentConfig.workspace;
  }
  if (agentConfig.agentDir) {
    return agentConfig.agentDir;
  }
  if (defaults.workspace) {
    return defaults.workspace;
  }
  return DEFAULT_WORKSPACE;
}

function getAgents(): AgentInfo[] {
  const config = loadOpenClawConfig();
  if (!config?.agents?.list) {
    // Return default agent if no config
    return [{
      id: "default",
      name: "Default Agent",
      workspace: DEFAULT_WORKSPACE,
      emoji: "🤖",
    }];
  }

  const defaults = config.agents.defaults || {};
  
  return config.agents.list.map((agent) => ({
    id: agent.id,
    name: agent.name || agent.id,
    workspace: getAgentWorkspace(agent, defaults),
    emoji: agent.identity?.emoji || "🤖",
    skills: agent.skills || undefined,
  }));
}

function getAgentById(agentId: string): AgentInfo | null {
  const agents = getAgents();
  return agents.find((a) => a.id === agentId) || null;
}

// Get workspace for a given agent ID
function getWorkspaceForAgent(agentId: string | null | undefined): string {
  if (!agentId || agentId === "default") {
    // Try to find "default" agent in config, otherwise use default workspace
    const agent = getAgentById("default");
    if (agent) return agent.workspace;
    return DEFAULT_WORKSPACE;
  }
  
  const agent = getAgentById(agentId);
  if (agent) return agent.workspace;
  
  // Fallback to default workspace if agent not found
  return DEFAULT_WORKSPACE;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safePath(filePath: string | undefined | null, workspace: string): string | null {
  if (!filePath || filePath.includes("..") || !filePath.endsWith(".md")) return null;
  const full = path.resolve(workspace, filePath);
  if (!full.startsWith(path.resolve(workspace))) return null;
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
// ---------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------

// Get agent from query parameter
function getAgentFromQuery(c: any): { agentId: string; workspace: string } {
  const agentId = c.req.query("agent") || "default";
  const workspace = getWorkspaceForAgent(agentId);
  return { agentId, workspace };
}

// Agents API
app.get("/api/agents", (c) => {
  return c.json(getAgents());
});

app.get("/api/skills", (c) => {
  const { workspace } = getAgentFromQuery(c);
  const skillsDir = path.join(workspace, "skills");
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

app.get("/api/files", (c) => {
  const { workspace } = getAgentFromQuery(c);
  return c.json(scanDir(workspace));
});

app.get("/api/file", (c) => {
  const { workspace } = getAgentFromQuery(c);
  const full = safePath(c.req.query("path"), workspace);
  if (!full) return c.json({ error: "Invalid path" }, 400);
  if (!fs.existsSync(full)) return c.json({ error: "Not found" }, 404);
  const content = fs.readFileSync(full, "utf-8");
  const stat = fs.statSync(full);
  return c.json({ content, mtime: stat.mtime, size: stat.size });
});

app.put("/api/file", async (c) => {
  const { workspace } = getAgentFromQuery(c);
  const { path: filePath, content, expectedMtime } = await c.req.json();
  const full = safePath(filePath, workspace);
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

app.get("/api/resolve-wikilink", (c) => {
  const { workspace } = getAgentFromQuery(c);
  const link = (c.req.query("link") || "").trim();
  if (!link) return c.json({ error: "Missing link parameter" }, 400);

  const allFiles = collectMdFiles(workspace);

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
  const { workspace } = getAgentFromQuery(c);
  const q = (c.req.query("q") || "").trim().toLowerCase();
  if (!q || q.length < 2) return c.json([]);

  const files = collectMdFiles(workspace);
  const results: { path: string; matches: { line: number; text: string }[] }[] = [];

  for (const relPath of files) {
    const full = path.join(workspace, relPath);
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

// QMD availability detection — cached at startup
let qmdAvailable: boolean | null = null;
let qmdHasVectors = false;

async function detectQmd(): Promise<void> {
  try {
    const { stdout } = await exec(
      `export PATH="$HOME/.bun/bin:$PATH" && qmd status 2>/dev/null`,
      { timeout: 5000 }
    );
    qmdAvailable = stdout.includes("Documents");
    qmdHasVectors = /Vectors:\s*[1-9]/.test(stdout);
    console.log(`🔍 QMD: ${qmdAvailable ? "available" : "not found"}${qmdHasVectors ? " (vectors ready)" : ""}`);
  } catch {
    qmdAvailable = false;
    qmdHasVectors = false;
    console.log("🔍 QMD: not installed");
  }
}

// Run detection on startup
detectQmd();

// External plugins directory
const PLUGINS_DIR = appSettings.pluginsDir || process.env.PLUGINS_DIR || "";

app.get("/api/plugins", (c) => {
  if (!PLUGINS_DIR || !fs.existsSync(PLUGINS_DIR)) return c.json([]);
  try {
    const plugins: { id: string; name: string; entry: string }[] = [];
    for (const dir of fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const manifestPath = path.join(PLUGINS_DIR, dir.name, "plugin.json");
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        plugins.push({ id: manifest.id || dir.name, name: manifest.name || dir.name, entry: manifest.entry || "index.js" });
      }
    }
    return c.json(plugins);
  } catch { return c.json([]); }
});

// Serve plugin files
app.get("/api/plugins/:id/*", (c) => {
  if (!PLUGINS_DIR) return c.text("No plugins dir", 404);
  const pluginId = c.req.param("id");
  const filePath = c.req.path.replace(`/api/plugins/${pluginId}/`, "");
  const full = path.join(PLUGINS_DIR, pluginId, filePath);
  if (!full.startsWith(path.join(PLUGINS_DIR, pluginId))) return c.text("Forbidden", 403);
  if (!fs.existsSync(full)) return c.text("Not found", 404);
  const content = fs.readFileSync(full, "utf-8");
  const ext = path.extname(full);
  const ct = ext === ".js" ? "application/javascript" : ext === ".css" ? "text/css" : "text/plain";
  return c.text(content, 200, { "Content-Type": ct });
});

app.get("/api/capabilities", (c) => {
  const embeddingReady = appSettings.embedding.enabled && !!appSettings.embedding.apiUrl && !!appSettings.embedding.apiKey;
  return c.json({
    qmd: qmdAvailable === true,
    qmdBm25: qmdAvailable === true,
    qmdVector: qmdHasVectors || embeddingReady,
    embeddingApi: embeddingReady,
  });
});

// Settings API
app.get("/api/settings", (c) => {
  return c.json({
    embedding: {
      enabled: appSettings.embedding.enabled,
      apiUrl: appSettings.embedding.apiUrl,
      apiKeySet: !!appSettings.embedding.apiKey,
      model: appSettings.embedding.model,
    },
  });
});

app.put("/api/settings", async (c) => {
  const body = await c.req.json();
  if (body.embedding) {
    appSettings.embedding.enabled = body.embedding.enabled ?? appSettings.embedding.enabled;
    appSettings.embedding.apiUrl = body.embedding.apiUrl ?? appSettings.embedding.apiUrl;
    appSettings.embedding.model = body.embedding.model ?? appSettings.embedding.model;
    if (body.embedding.apiKey) {
      appSettings.embedding.apiKey = body.embedding.apiKey;
    }
  }
  saveSettings(appSettings);
  return c.json({ ok: true });
});

app.get("/api/settings/embedding-stats", (c) => {
  const { workspace } = getAgentFromQuery(c);
  try {
    const db = getEmbeddingsDb();
    const model = appSettings.embedding.model || "text-embedding-3-small";
    const total = (db.prepare("SELECT COUNT(*) as n FROM embeddings WHERE model = ?").get(model) as any)?.n || 0;
    const allFiles = collectMdFiles(workspace).length;
    const dbSize = fs.existsSync(EMBEDDINGS_DB_PATH) ? fs.statSync(EMBEDDINGS_DB_PATH).size : 0;
    return c.json({
      cachedFiles: total,
      totalFiles: allFiles,
      coverage: allFiles > 0 ? Math.round((total / allFiles) * 100) : 0,
      dbSize,
      model,
    });
  } catch {
    return c.json({ cachedFiles: 0, totalFiles: 0, coverage: 0, dbSize: 0, model: "" });
  }
});

app.post("/api/settings/test-embedding", async (c) => {
  const { apiUrl, apiKey, model } = await c.req.json();
  const url = apiUrl || appSettings.embedding.apiUrl;
  const key = apiKey || appSettings.embedding.apiKey;
  const mdl = model || appSettings.embedding.model || "text-embedding-3-small";

  if (!url) return c.json({ ok: false, message: "API URL is required" });

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({ input: "test", model: mdl }),
      signal: AbortSignal.timeout(10000),
    });
    const data: any = await resp.json();
    if (data.data?.[0]?.embedding) {
      const dim = data.data[0].embedding.length;
      return c.json({ ok: true, message: `✅ ${dim}维向量` });
    }
    return c.json({ ok: false, message: data.error?.message || "Unexpected response" });
  } catch (e: any) {
    return c.json({ ok: false, message: e.message || "Connection failed" });
  }
});

function qmdUriToRelPath(uri: string): string {
  // qmd://clawd-memory/memory/survival.md → memory/survival.md
  // qmd://clawd-root/MEMORY.md → MEMORY.md
  // All collections index from workspace root, so just strip the qmd://collection/ prefix
  const match = uri.match(/^qmd:\/\/[^/]+\/(.+)$/);
  return match ? match[1] : uri;
}

// Embedding API helper
async function getEmbedding(text: string): Promise<number[] | null> {
  const { apiUrl, apiKey, model } = appSettings.embedding;
  if (!apiUrl || !apiKey) return null;
  try {
    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: text, model: model || "text-embedding-3-small" }),
      signal: AbortSignal.timeout(10000),
    });
    const data: any = await resp.json();
    return data.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
}

// SQLite embedding cache — persistent across restarts
const EMBEDDINGS_DB_PATH = path.join(SETTINGS_DIR, "embeddings.sqlite");
let embeddingsDb: Database.Database | null = null;

function getEmbeddingsDb(): Database.Database {
  if (!embeddingsDb) {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true });
    embeddingsDb = new Database(EMBEDDINGS_DB_PATH);
    embeddingsDb.pragma("journal_mode = WAL");
    embeddingsDb.exec(`
      CREATE TABLE IF NOT EXISTS embeddings (
        file_path TEXT PRIMARY KEY,
        mtime REAL NOT NULL,
        model TEXT NOT NULL,
        embedding BLOB NOT NULL
      )
    `);
  }
  return embeddingsDb;
}

function getCachedEmbedding(filePath: string, mtime: number): number[] | null {
  const db = getEmbeddingsDb();
  const model = appSettings.embedding.model || "text-embedding-3-small";
  const row = db.prepare("SELECT embedding FROM embeddings WHERE file_path = ? AND mtime = ? AND model = ?").get(filePath, mtime, model) as any;
  if (!row) return null;
  return Array.from(new Float64Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 8));
}

function setCachedEmbedding(filePath: string, mtime: number, embedding: number[]): void {
  const db = getEmbeddingsDb();
  const model = appSettings.embedding.model || "text-embedding-3-small";
  const buf = Buffer.from(new Float64Array(embedding).buffer);
  db.prepare("INSERT OR REPLACE INTO embeddings (file_path, mtime, model, embedding) VALUES (?, ?, ?, ?)").run(filePath, mtime, model, buf);
}

async function getFileEmbeddings(files: string[], workspace: string): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();
  const toEmbed: string[] = [];

  for (const relPath of files) {
    const full = path.join(workspace, relPath);
    try {
      const stat = fs.statSync(full);
      const cached = getCachedEmbedding(relPath, stat.mtimeMs);
      if (cached) {
        result.set(relPath, cached);
      } else {
        toEmbed.push(relPath);
      }
    } catch { /* skip */ }
  }

  // Embed uncached files (max 20 per request to stay responsive)
  for (const relPath of toEmbed.slice(0, 20)) {
    const full = path.join(workspace, relPath);
    try {
      const content = fs.readFileSync(full, "utf-8").substring(0, 2000);
      const emb = await getEmbedding(content);
      if (emb) {
        const stat = fs.statSync(full);
        setCachedEmbedding(relPath, stat.mtimeMs, emb);
        result.set(relPath, emb);
      }
    } catch { /* skip */ }
  }

  return result;
}

app.get("/api/semantic-search", async (c) => {
  const { workspace } = getAgentFromQuery(c);
  const q = (c.req.query("q") || "").trim();
  const mode = c.req.query("mode") || "bm25"; // bm25 | vector
  if (!q || q.length < 2) return c.json([]);

  // BM25 mode: use QMD
  if (mode === "bm25" && qmdAvailable) {
    try {
      const { stdout } = await exec(
        `export PATH="$HOME/.bun/bin:$PATH" && qmd search ${JSON.stringify(q)} -n 10 --json`,
        { timeout: 20000 }
      );
      const raw: { docid: string; score: number; file: string; title: string; snippet: string }[] = JSON.parse(stdout);
      return c.json(raw.map((r) => ({
        path: qmdUriToRelPath(r.file),
        title: r.title,
        snippet: r.snippet.replace(/@@ [^@]+ @@[^\n]*\n?/, "").substring(0, 300),
        score: Math.round(r.score * 100),
      })));
    } catch (e: any) {
      console.error("BM25 search error:", e.message);
      return c.json([]);
    }
  }

  // Vector mode: use embedding API
  if (mode === "vector" && appSettings.embedding.enabled && appSettings.embedding.apiKey) {
    try {
      const queryEmb = await getEmbedding(q);
      if (!queryEmb) return c.json([]);

      const files = collectMdFiles(workspace);
      const fileEmbs = await getFileEmbeddings(files, workspace);

      const scored: { path: string; score: number; snippet: string; title: string }[] = [];
      for (const [filePath, emb] of fileEmbs) {
        const sim = cosineSim(queryEmb, emb);
        const full = path.join(workspace, filePath);
        let content = "";
        try { content = fs.readFileSync(full, "utf-8"); } catch { continue; }
        const firstLine = content.split("\n").find(l => l.startsWith("#"))?.replace(/^#+\s*/, "") || filePath;
        scored.push({
          path: filePath,
          score: Math.round(sim * 100),
          title: firstLine,
          snippet: content.substring(0, 300).replace(/\n/g, " "),
        });
      }

      scored.sort((a, b) => b.score - a.score);
      return c.json(scored.slice(0, 10));
    } catch (e: any) {
      console.error("Vector search error:", e.message);
      return c.json([]);
    }
  }

  return c.json([]);
});

// ============================================================================
// Tags API - Extract and manage tags from markdown files
// ============================================================================

interface TagInfo {
  name: string;
  count: number;
  files: string[];
}

interface FileWithTags {
  path: string;
  title: string;
  preview: string;
  date: string;
  tags: string[];
}

// Extract tags from content: ## headers and #hashtags
function extractTags(content: string): string[] {
  const tags = new Set<string>();

  // Extract ## headers
  const headers = content.match(/^##\s+(.+)$/gm) || [];
  headers.forEach(h => {
    const tag = h.replace(/^##\s+/, "").replace(/[*_`]/g, "").trim();
    if (tag.length < 30 && tag.length > 0) tags.add(tag);
  });

  // Extract #hashtags (but not markdown headers)
  const hashtags = content.match(/(?<![#\w])#([\w\u4e00-\u9fa5_-]+)/g) || [];
  hashtags.forEach(h => {
    const tag = h.replace(/^#/, "").trim();
    if (tag.length < 30 && tag.length > 0) tags.add(tag);
  });

  return Array.from(tags);
}

// Scan all markdown files and extract tags
function scanAllTags(workspace: string): Map<string, TagInfo> {
  const tagMap = new Map<string, TagInfo>();
  const mdFiles = collectMdFiles(workspace);

  for (const relPath of mdFiles) {
    const fullPath = path.join(workspace, relPath);
    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      const tags = extractTags(content);

      for (const tag of tags) {
        if (!tagMap.has(tag)) {
          tagMap.set(tag, { name: tag, count: 0, files: [] });
        }
        const info = tagMap.get(tag)!;
        info.count++;
        info.files.push(relPath);
      }
    } catch { /* skip */ }
  }

  return tagMap;
}

app.get("/api/tags", (c) => {
  const { workspace } = getAgentFromQuery(c);
  const tagMap = scanAllTags(workspace);
  const tags = Array.from(tagMap.values()).sort((a, b) => b.count - a.count);
  return c.json(tags);
});

app.get("/api/files-by-tag/:tag", (c) => {
  const { workspace } = getAgentFromQuery(c);
  const tagParam = decodeURIComponent(c.req.param("tag"));
  const tagMap = scanAllTags(workspace);
  const tagInfo = tagMap.get(tagParam);

  if (!tagInfo) {
    return c.json([]);
  }

  const results: FileWithTags[] = [];
  for (const relPath of tagInfo.files) {
    const fullPath = path.join(workspace, relPath);
    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      const clean = content.replace(/^---[\s\S]*?---/, "").trim();
      const titleMatch = clean.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : path.basename(relPath, ".md");
      const lines = clean.split("\n").filter(l => l.trim() && !l.startsWith("#"));
      let preview = lines.slice(0, 2).join(" ").replace(/[*_`\[\]]/g, "").trim();
      if (preview.length > 120) preview = preview.slice(0, 120) + "…";
      const date = relPath.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || "";
      const fileTags = extractTags(content);

      results.push({
        path: relPath,
        title,
        preview: preview || "(空)",
        date,
        tags: fileTags,
      });
    } catch { /* skip */ }
  }

  // Sort by date (newest first)
  results.sort((a, b) => b.date.localeCompare(a.date));
  return c.json(results);
});

app.get("/api/timeline", (c) => {
  const { workspace } = getAgentFromQuery(c);
  const memoryDir = path.join(workspace, "memory");
  const results: { date: string; path: string; title: string; preview: string; tags: string[]; charCount: number }[] = [];

  function scanDir(dir: string, rel: string) {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        scanDir(path.join(dir, e.name), rel ? `${rel}/${e.name}` : e.name);
      } else if (e.isFile() && /^\d{4}-\d{2}-\d{2}(-\w+)?\.md$/.test(e.name)) {
        const filePath = `memory/${rel ? rel + "/" : ""}${e.name}`;
        const fullPath = path.join(dir, e.name);
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          const date = e.name.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || "";
          const clean = content.replace(/^---[\s\S]*?---/, "").trim();
          const titleMatch = clean.match(/^#\s+(.+)$/m);
          const title = titleMatch ? titleMatch[1].trim() : e.name.replace(/\.md$/, "");
          const lines = clean.split("\n").filter(l => l.trim() && !l.startsWith("#"));
          let preview = lines.slice(0, 2).join(" ").replace(/[*_`\[\]]/g, "").trim();
          if (preview.length > 120) preview = preview.slice(0, 120) + "…";
          const headers = content.match(/^##\s+(.+)$/gm) || [];
          const tags = headers.map(h => h.replace(/^##\s+/, "").replace(/[*_`]/g, "").trim()).filter(t => t.length < 20).slice(0, 4);
          results.push({ date, path: filePath, title, preview: preview || "(空)", tags, charCount: content.length });
        } catch { /* skip */ }
      }
    }
  }

  scanDir(memoryDir, "");
  results.sort((a, b) => b.date.localeCompare(a.date));
  return c.json(results);
});

app.get("/api/recent", (c) => {
  const { workspace } = getAgentFromQuery(c);
  const files = collectMdFiles(workspace);
  const withStats = files.map((relPath) => {
    const full = path.join(workspace, relPath);
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
  const { workspace } = getAgentFromQuery(c);
  const memoryDir = path.join(workspace, "memory");
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
  const { workspace } = getAgentFromQuery(c);
  const memoryDir = path.join(workspace, "memory");
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
  const { workspace } = getAgentFromQuery(c);
  let name = "Unknown Bot";
  let description = "";
  for (const fname of ["IDENTITY.md", "SOUL.md"]) {
    const fpath = path.join(workspace, fname);
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
  const { workspace } = getAgentFromQuery(c);
  const uptime = os.uptime();
  const memTotal = os.totalmem();
  const memFree = os.freemem();
  const load = os.loadavg();
  const platform = `${os.platform()} ${os.release()}`;
  const hostname = os.hostname();

  const today = new Date().toISOString().split("T")[0];
  const todayPath = path.join(workspace, "memory", `${today}.md`);
  let todayMemory = null;
  if (fs.existsSync(todayPath)) {
    const content = fs.readFileSync(todayPath, "utf-8");
    todayMemory = {
      filename: `memory/${today}.md`,
      snippet: content.split("\n").slice(0, 10).join("\n"),
      length: content.length,
    };
  }

  const totalFiles = collectMdFiles(workspace).length;

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
    const hbPath = path.join(DEFAULT_WORKSPACE, "memory", "heartbeat-state.json");
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
  const { workspace } = getAgentFromQuery(c);
  const { path: filePath, content: providedContent, save } = await c.req.json();
  const full = safePath(filePath, workspace);
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
const wsClients = new Set<WSContext>();

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

const watcher = watch(path.join(DEFAULT_WORKSPACE, "**/*.md"), {
  ignoreInitial: true,
  ignored: /(^|[/\\])\.(git|node_modules)/,
  awaitWriteFinish: { stabilityThreshold: 300 },
});

watcher.on("all", (event, filePath) => {
  const rel = path.relative(DEFAULT_WORKSPACE, filePath);
  broadcast({ type: "file-change", event, path: rel });
});

// ---------------------------------------------------------------------------
// Workspace assets (images, SVGs, etc.)
// ---------------------------------------------------------------------------
app.get("/workspace-assets/*", async (c) => {
  const { workspace } = getAgentFromQuery(c);
  const assetPath = c.req.path.replace("/workspace-assets/", "");
  const fullPath = path.join(workspace, "assets", assetPath);
  if (!fullPath.startsWith(path.join(workspace, "assets"))) {
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
// Cron API — read OpenClaw cron jobs and run history
// ---------------------------------------------------------------------------
const CRON_JOBS_FILE = path.join(os.homedir(), ".openclaw", "cron", "jobs.json");
const CRON_RUNS_DIR = path.join(os.homedir(), ".openclaw", "cron", "runs");

interface CronJob {
  id: string;
  name?: string;
  enabled: boolean;
  schedule?: { kind: string; expr?: string; everyMs?: number; at?: string };
  payload?: { kind: string; text?: string; message?: string };
  sessionTarget?: string;
  agentId?: string;
  wakeMode?: string;
  state?: { nextRunAtMs?: number; lastRunAtMs?: number; lastStatus?: string };
  delivery?: { mode?: string };
}

function readCronJobs(): CronJob[] {
  try {
    const data = fs.readFileSync(CRON_JOBS_FILE, "utf-8");
    const json = JSON.parse(data);
    return json.jobs || [];
  } catch {
    return [];
  }
}

function writeCronJobs(jobs: CronJob[]): boolean {
  try {
    fs.copyFileSync(CRON_JOBS_FILE, CRON_JOBS_FILE + ".bak");
    fs.writeFileSync(CRON_JOBS_FILE, JSON.stringify({ version: 1, jobs }, null, 2));
    return true;
  } catch {
    return false;
  }
}

function readCronRuns(jobId: string): any[] {
  try {
    const runFile = path.join(CRON_RUNS_DIR, `${jobId}.jsonl`);
    const data = fs.readFileSync(runFile, "utf-8");
    return data.trim().split("\n").filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean).reverse();
  } catch {
    return [];
  }
}

function formatCronJob(job: CronJob) {
  let scheduleDisplay = "-";
  if (job.schedule) {
    if (job.schedule.kind === "cron" && job.schedule.expr) scheduleDisplay = job.schedule.expr;
    else if (job.schedule.kind === "every" && job.schedule.everyMs) scheduleDisplay = `every ${Math.round(job.schedule.everyMs / 60000)}m`;
    else if (job.schedule.kind === "at" && job.schedule.at) scheduleDisplay = `at ${job.schedule.at}`;
  }
  return {
    id: job.id,
    name: job.name || "Unnamed",
    enabled: job.enabled !== false,
    schedule: scheduleDisplay,
    scheduleRaw: job.schedule,
    nextRun: job.state?.nextRunAtMs ? new Date(job.state.nextRunAtMs).toISOString() : null,
    lastRun: job.state?.lastRunAtMs ? new Date(job.state.lastRunAtMs).toISOString() : null,
    lastStatus: job.state?.lastStatus || null,
    sessionTarget: job.sessionTarget || job.agentId || "-",
    wakeMode: job.wakeMode || "next-heartbeat",
    payloadKind: job.payload?.kind || "-",
    deliveryMode: job.delivery?.mode || "-",
  };
}

app.get("/api/crons", (c) => {
  const jobs = readCronJobs();
  return c.json({ crons: jobs.map(formatCronJob) });
});

app.get("/api/crons/:id/runs", (c) => {
  const { id } = c.req.param();
  const runs = readCronRuns(id);
  return c.json({ runs: runs.slice(0, 30) });
});

app.post("/api/crons/:id/toggle", async (c) => {
  const { id } = c.req.param();
  const { enabled } = await c.req.json();
  const jobs = readCronJobs();
  const idx = jobs.findIndex(j => j.id === id);
  if (idx === -1) return c.json({ error: "Job not found" }, 404);
  jobs[idx].enabled = enabled;
  const ok = writeCronJobs(jobs);
  return c.json({ success: ok, job: formatCronJob(jobs[idx]) });
});

app.post("/api/crons/:id/run", async (c) => {
  const { id } = c.req.param();
  try {
    const { stdout } = await exec(`openclaw cron run ${id} --force 2>&1`, { timeout: 10000 });
    return c.json({ success: true, result: stdout.trim() });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// System Crons API — heartbeat, compaction, pruning, session cleanup
// ---------------------------------------------------------------------------
app.get("/api/system-crons", (c) => {
  try {
    const configPath = path.join(os.homedir(), ".openclaw", "openclaw.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const defaults = config.agents?.defaults || {};
    const agentList = config.agents?.list || [];

    const systemCrons: any[] = [];

    // Heartbeat
    const hbEvery = defaults.heartbeat?.every || "disabled";
    systemCrons.push({
      id: "sys-heartbeat",
      name: "💓 心跳检测",
      type: "heartbeat",
      schedule: hbEvery === "disabled" ? "禁用" : `每 ${hbEvery}`,
      enabled: hbEvery !== "disabled",
      description: "定期唤醒 agent 执行 HEARTBEAT.md 检查",
      agents: agentList.map((a: any) => ({
        id: a.id,
        name: a.identity?.name || a.name || a.id,
        heartbeat: a.heartbeat?.every || hbEvery,
        enabled: (a.heartbeat?.every || hbEvery) !== "disabled",
      })),
    });

    // Compaction
    const compMode = defaults.compaction?.mode || "off";
    const flushEnabled = defaults.compaction?.memoryFlush?.enabled || false;
    const flushThreshold = defaults.compaction?.memoryFlush?.softThresholdTokens;
    systemCrons.push({
      id: "sys-compaction",
      name: "🗜️ 上下文压缩",
      type: "compaction",
      schedule: "按需触发",
      enabled: compMode !== "off",
      description: `模式: ${compMode}${flushEnabled ? ` | Memory flush: ${flushThreshold ? flushThreshold + " tokens" : "启用"}` : ""}`,
    });

    // Context Pruning
    const pruneMode = defaults.contextPruning?.mode || "off";
    const pruneTTL = defaults.contextPruning?.ttl;
    systemCrons.push({
      id: "sys-context-pruning",
      name: "✂️ 上下文修剪",
      type: "context-pruning",
      schedule: pruneTTL ? `TTL ${pruneTTL}` : "按需",
      enabled: pruneMode !== "off",
      description: `模式: ${pruneMode}${pruneTTL ? ` | 缓存过期: ${pruneTTL}` : ""}`,
    });

    // Session cleanup (2026.2.9 feature)
    systemCrons.push({
      id: "sys-session-cleanup",
      name: "🗑️ Session 清理",
      type: "session-cleanup",
      schedule: "自动",
      enabled: true,
      description: "自动修剪过期 session，防止磁盘占满",
    });

    // QMD Memory refresh
    const qmd = config.memory?.qmd;
    if (qmd && config.memory?.backend === "qmd") {
      systemCrons.push({
        id: "sys-qmd-refresh",
        name: "🧠 QMD 记忆索引",
        type: "qmd",
        schedule: qmd.update?.interval ? `每 ${qmd.update.interval}` : "手动",
        enabled: true,
        description: `后台刷新: ${qmd.update?.onBoot ? "启动时 + " : ""}${qmd.update?.interval || "手动"}`,
      });
    }

    return c.json({ systemCrons });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
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
    console.log(`📂 Default Workspace: ${DEFAULT_WORKSPACE}`);
  });
  injectWebSocket(server);
}
