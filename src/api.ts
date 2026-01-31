/** API client for Memory Viewer backend. */

const BASE = "";

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

export async function fetchFiles(): Promise<FileNode[]> {
  const r = await fetch(`${BASE}/api/files`);
  return r.json();
}

export async function fetchFile(path: string): Promise<FileData> {
  const r = await fetch(`${BASE}/api/file?path=${encodeURIComponent(path)}`);
  if (!r.ok) throw new Error("Failed to load file");
  return r.json();
}

export async function saveFile(path: string, content: string): Promise<{ ok: boolean; mtime: string }> {
  const r = await fetch(`${BASE}/api/file`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
  return r.json();
}

export async function fetchSystem(): Promise<SystemInfo> {
  const r = await fetch(`${BASE}/api/system`);
  return r.json();
}

export async function searchFiles(query: string): Promise<SearchResult[]> {
  const r = await fetch(`${BASE}/api/search?q=${encodeURIComponent(query)}`);
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

export async function fetchRecent(limit = 10): Promise<RecentFile[]> {
  const r = await fetch(`${BASE}/api/recent?limit=${limit}`);
  return r.json();
}

export async function fetchMonthlyStats(): Promise<MonthlyStats[]> {
  const r = await fetch(`${BASE}/api/stats/monthly`);
  return r.json();
}
