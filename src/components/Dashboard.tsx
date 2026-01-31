import { useEffect, useState } from "react";
import { fetchSystem, type SystemInfo } from "../api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LayoutDashboard, FileText } from "lucide-react";

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
      <div className="flex items-center justify-center h-full" style={{ color: "var(--text-faint)" }}>
        <div className="w-5 h-5 border-2 border-t-blue-400 rounded-full animate-spin mr-3" style={{ borderColor: "var(--border)" }} />
        Loading…
      </div>
    );
  }

  const memPercent = ((info.memUsed / info.memTotal) * 100).toFixed(1);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
        <LayoutDashboard className="w-7 h-7 text-blue-400" /> Dashboard
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Uptime" value={formatUptime(info.uptime)} />
        <StatCard label="Memory" value={`${memPercent}%`} sub={`${formatBytes(info.memUsed)} / ${formatBytes(info.memTotal)}`} />
        <StatCard label="Load" value={info.load[0].toFixed(2)} sub={info.load.map((l) => l.toFixed(2)).join(" · ")} />
        <StatCard label="Files" value={String(info.totalFiles)} sub=".md files tracked" />
      </div>

      {/* Host info */}
      <div className="text-sm flex items-center gap-2" style={{ color: "var(--text-faint)" }}>
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
        {info.hostname} · {info.platform}
      </div>

      {/* Today's memory */}
      <section className="rounded-xl p-5" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <FileText className="w-5 h-5" style={{ color: "var(--text-muted)" }} /> Today&apos;s Memory
          </h2>
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
            <div className="text-xs mt-3" style={{ color: "var(--text-faint)" }}>
              {info.todayMemory.length.toLocaleString()} characters
            </div>
          </div>
        ) : (
          <p style={{ color: "var(--text-faint)" }} className="italic">No memory entries for today yet.</p>
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
    <div className="rounded-xl p-4" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
      <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>{label}</div>
      <div className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>{sub}</div>}
    </div>
  );
}
