import { useEffect, useState } from "react";
import { fetchSystem, type SystemInfo } from "../api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  parts.push(`${h}h ${m}m`);
  return parts.join(" ");
}

function formatBytes(bytes: number): string {
  return (bytes / 1024 / 1024 / 1024).toFixed(1) + " GB";
}

export function Dashboard({ onOpenFile }: { onOpenFile: (path: string) => void }) {
  const [info, setInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    fetchSystem().then(setInfo).catch(console.error);
  }, []);

  if (!info) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="w-5 h-5 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin mr-3" />
        Loading…
      </div>
    );
  }

  const memPercent = ((info.memUsed / info.memTotal) * 100).toFixed(1);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <span className="text-3xl">📊</span> Dashboard
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Uptime" value={formatUptime(info.uptime)} />
        <StatCard label="Memory" value={`${memPercent}%`} sub={`${formatBytes(info.memUsed)} / ${formatBytes(info.memTotal)}`} />
        <StatCard label="Load" value={info.load[0].toFixed(2)} sub={info.load.map((l) => l.toFixed(2)).join(" · ")} />
        <StatCard label="Files" value={String(info.totalFiles)} sub=".md files tracked" />
      </div>

      {/* Host info */}
      <div className="text-sm text-gray-500 flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
        {info.hostname} · {info.platform}
      </div>

      {/* Today's memory */}
      <section className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">📝 Today&apos;s Memory</h2>
          {info.todayMemory && (
            <button
              onClick={() => onOpenFile(info.todayMemory!.filename)}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              View full →
            </button>
          )}
        </div>
        {info.todayMemory ? (
          <div className="markdown-body text-sm opacity-80">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {info.todayMemory.snippet}
            </ReactMarkdown>
            <div className="text-xs text-gray-600 mt-3">
              {info.todayMemory.length.toLocaleString()} characters
            </div>
          </div>
        ) : (
          <p className="text-gray-500 italic">No memory entries for today yet.</p>
        )}
      </section>

      {/* Quick access */}
      <div className="flex flex-wrap gap-2">
        {["MEMORY.md", "SOUL.md", "USER.md", "AGENTS.md"].map((f) => (
          <button
            key={f}
            onClick={() => onOpenFile(f)}
            className="btn-secondary text-sm"
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}
