/** API client for Memory Viewer backend. */

let _baseUrl = "";

export function getBaseUrl(): string {
  return _baseUrl;
}

export function setBaseUrl(url: string) {
  _baseUrl = url.replace(/\/+$/, "");
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

export async function fetchSkills(): Promise<SkillInfo[]> {
  const r = await fetch(`${_baseUrl}/api/skills`);
  return r.json();
}

export async function fetchFiles(): Promise<FileNode[]> {
  const r = await fetch(`${_baseUrl}/api/files`);
  return r.json();
}

export async function fetchFile(path: string): Promise<FileData> {
  const r = await fetch(`${_baseUrl}/api/file?path=${encodeURIComponent(path)}`);
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
  const r = await fetch(`${_baseUrl}/api/file`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content, expectedMtime }),
  });
  return r.json();
}

export async function fetchSystem(): Promise<SystemInfo> {
  const r = await fetch(`${_baseUrl}/api/system`);
  return r.json();
}

export async function searchFiles(query: string): Promise<SearchResult[]> {
  const r = await fetch(`${_baseUrl}/api/search?q=${encodeURIComponent(query)}`);
  return r.json();
}

export interface SemanticResult {
  path: string;
  title: string;
  snippet: string;
  score: number;
}

export async function semanticSearch(query: string, mode: "bm25" | "vector" = "bm25"): Promise<SemanticResult[]> {
  const r = await fetch(`${_baseUrl}/api/semantic-search?q=${encodeURIComponent(query)}&mode=${mode}`);
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
  const r = await fetch(`${_baseUrl}/api/timeline`);
  return r.json();
}

export async function fetchRecent(limit = 10): Promise<RecentFile[]> {
  const r = await fetch(`${_baseUrl}/api/recent?limit=${limit}`);
  return r.json();
}

export async function fetchMonthlyStats(): Promise<MonthlyStats[]> {
  const r = await fetch(`${_baseUrl}/api/stats/monthly`);
  return r.json();
}

export interface DailyStats { date: string; count: number; size: number; }

export async function fetchDailyStats(): Promise<DailyStats[]> {
  const r = await fetch(`${_baseUrl}/api/stats/daily`);
  return r.json();
}

export async function fetchBotInfo(baseUrl = ""): Promise<BotInfo> {
  const r = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/info`);
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
  const r = await fetch(`${_baseUrl}/api/resolve-wikilink?link=${encodeURIComponent(link)}`);
  return r.json();
}

export interface SummarizeResult {
  summary: string;
  saved: boolean;
  mtime?: string;
  error?: string;
}

export async function summarizeFile(path: string, save = false): Promise<SummarizeResult> {
  const r = await fetch(`${_baseUrl}/api/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, save }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Summarize failed");
  return data;
}

export async function fetchAgentStatus(): Promise<AgentStatus> {
  const r = await fetch(`${_baseUrl}/api/agent/status`);
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
    const r = await fetch(`${_baseUrl}/api/capabilities`);
    return r.json();
  } catch {
    return { qmd: false, qmdBm25: false, qmdVector: false, embeddingApi: false };
  }
}

export async function fetchSettings(): Promise<Settings> {
  const r = await fetch(`${_baseUrl}/api/settings`);
  return r.json();
}

export async function saveSettings(settings: Partial<Settings>): Promise<{ success: boolean }> {
  const r = await fetch(`${_baseUrl}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  return r.json();
}

export async function testEmbeddingConnection(settings?: Partial<EmbeddingSettings>): Promise<{ success: boolean; error?: string }> {
  const r = await fetch(`${_baseUrl}/api/settings/test-embedding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings || {}),
  });
  return r.json();
}
