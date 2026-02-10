/** API client for Memory Viewer backend. */

let _baseUrl = "";
let _currentAgent: string | null = null;

export function getBaseUrl(): string {
  return _baseUrl;
}

export function setBaseUrl(url: string) {
  _baseUrl = url.replace(/\/+$/, "");
}

export function getCurrentAgent(): string | null {
  return _currentAgent;
}

export function setCurrentAgent(agentId: string | null) {
  _currentAgent = agentId;
}

// Helper to build URL with agent parameter
function buildUrl(endpoint: string, params?: Record<string, string>): string {
  const base = _baseUrl || window.location.origin;
  const url = new URL(`${base}${endpoint}`);
  if (_currentAgent) {
    url.searchParams.set("agent", _currentAgent);
  }
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  return url.toString();
}

export interface FileNode {
  name: string;
  type: "file" | "dir";
  path: string;
  children?: FileNode[];
}

export interface FileData {
  content: string;
  mtime: string;
  size: number;
}

export interface SystemInfo {
  uptime: number;
  memTotal: number;
  memFree: number;
  memUsed: number;
  load: number[];
  platform: string;
  hostname: string;
  totalFiles: number;
  todayMemory: {
    filename: string;
    snippet: string;
    length: number;
  } | null;
}

export interface SearchResult {
  path: string;
  matches: { line: number; text: string }[];
}

export interface BotInfo {
  name: string;
  version: string;
  description: string;
}

export interface SkillInfo { id: string; name: string; description: string; path: string; }

// Agent types
export interface AgentInfo {
  id: string;
  name: string;
  workspace: string;
  emoji: string;
}

export async function fetchAgents(): Promise<AgentInfo[]> {
  const r = await fetch(`${_baseUrl}/api/agents`);
  if (!r.ok) throw new Error("Failed to load agents");
  return r.json();
}

export async function fetchSkills(): Promise<SkillInfo[]> {
  const r = await fetch(buildUrl("/api/skills"));
  return r.json();
}

export async function fetchFiles(): Promise<FileNode[]> {
  const r = await fetch(buildUrl("/api/files"));
  return r.json();
}

export async function fetchFile(path: string): Promise<FileData> {
  const r = await fetch(buildUrl("/api/file", { path }));
  if (!r.ok) throw new Error("Failed to load file");
  return r.json();
}

export interface SaveResult {
  ok: boolean;
  mtime: string;
}

export interface ConflictResult {
  error: "conflict";
  message: string;
  serverMtime: string;
  serverContent: string;
}

export async function saveFile(
  path: string,
  content: string,
  expectedMtime?: string
): Promise<SaveResult | ConflictResult> {
  const r = await fetch(buildUrl("/api/file"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content, expectedMtime }),
  });
  return r.json();
}

export async function fetchSystem(): Promise<SystemInfo> {
  const r = await fetch(buildUrl("/api/system"));
  return r.json();
}

export async function searchFiles(query: string): Promise<SearchResult[]> {
  const r = await fetch(buildUrl("/api/search", { q: query }));
  return r.json();
}

export interface SemanticResult {
  path: string;
  title: string;
  snippet: string;
  score: number;
}

export async function semanticSearch(query: string, mode: "bm25" | "vector" = "bm25"): Promise<SemanticResult[]> {
  const r = await fetch(buildUrl("/api/semantic-search", { q: query, mode }));
  return r.json();
}

export interface RecentFile {
  path: string;
  mtime: number;
  size: number;
}

export interface MonthlyStats {
  month: string;
  count: number;
}

export interface TimelineEntry {
  date: string;
  path: string;
  title: string;
  preview: string;
  tags: string[];
  charCount: number;
}

export async function fetchTimeline(): Promise<TimelineEntry[]> {
  const r = await fetch(buildUrl("/api/timeline"));
  return r.json();
}

// ============================================================================
// Tags API
// ============================================================================

export interface TagInfo {
  name: string;
  count: number;
  files: string[];
}

export interface FileWithTags {
  path: string;
  title: string;
  preview: string;
  date: string;
  tags: string[];
}

export async function fetchTags(): Promise<TagInfo[]> {
  const r = await fetch(buildUrl("/api/tags"));
  return r.json();
}

export async function fetchFilesByTag(tag: string): Promise<FileWithTags[]> {
  const r = await fetch(buildUrl(`/api/files-by-tag/${encodeURIComponent(tag)}`));
  return r.json();
}

export async function fetchRecent(limit = 10): Promise<RecentFile[]> {
  const r = await fetch(buildUrl("/api/recent", { limit: String(limit) }));
  return r.json();
}

export async function fetchMonthlyStats(): Promise<MonthlyStats[]> {
  const r = await fetch(buildUrl("/api/stats/monthly"));
  return r.json();
}

export interface DailyStats { date: string; count: number; size: number; }

export async function fetchDailyStats(): Promise<DailyStats[]> {
  const r = await fetch(buildUrl("/api/stats/daily"));
  return r.json();
}

export async function fetchBotInfo(baseUrl = ""): Promise<BotInfo> {
  const url = baseUrl ? baseUrl.replace(/\/+$/, "") : _baseUrl;
  const r = await fetch(`${url}/api/info${_currentAgent ? `?agent=${_currentAgent}` : ""}`);
  return r.json();
}

export async function checkConnection(baseUrl: string): Promise<boolean> {
  try {
    const r = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/system`, { signal: AbortSignal.timeout(5000) });
    return r.ok;
  } catch {
    return false;
  }
}

export interface AgentStatus {
  config: any;
  gateway: any;
  heartbeat: any;
}

export interface WikilinkResolution {
  found: boolean;
  path: string | null;
}

export async function resolveWikilink(link: string): Promise<WikilinkResolution> {
  const r = await fetch(buildUrl("/api/resolve-wikilink", { link }));
  return r.json();
}

export interface SummarizeResult {
  summary: string;
  saved: boolean;
  mtime?: string;
  error?: string;
}

export async function summarizeFile(path: string, save = false): Promise<SummarizeResult> {
  const r = await fetch(buildUrl("/api/summarize"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, save }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Summarize failed");
  return data;
}

export async function fetchAgentStatus(): Promise<AgentStatus> {
  const r = await fetch(`${_baseUrl}/api/agent/status${_currentAgent ? `?agent=${_currentAgent}` : ""}`);
  return r.json();
}

export interface EmbeddingSettings {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  model: string;
  apiKeySet?: boolean;
}

export interface Settings {
  embedding: EmbeddingSettings;
}

export interface Capabilities {
  qmd: boolean;
  qmdBm25: boolean;
  qmdVector: boolean;
  embeddingApi: boolean;
}

export async function fetchCapabilities(): Promise<Capabilities> {
  try {
    const r = await fetch(buildUrl("/api/capabilities"));
    return r.json();
  } catch {
    return { qmd: false, qmdBm25: false, qmdVector: false, embeddingApi: false };
  }
}

export async function fetchSettings(): Promise<Settings> {
  const r = await fetch(buildUrl("/api/settings"));
  return r.json();
}

export async function saveSettings(settings: Partial<Settings>): Promise<{ success: boolean }> {
  const r = await fetch(buildUrl("/api/settings"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  return r.json();
}

export async function testEmbeddingConnection(settings?: Partial<EmbeddingSettings>): Promise<{ success: boolean; error?: string }> {
  const r = await fetch(buildUrl("/api/settings/test-embedding"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings || {}),
  });
  return r.json();
}
