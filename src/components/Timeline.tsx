import { useEffect, useMemo, useState } from "react";
import { Calendar, FileText, CaretDown, CaretRight, Clock, Hash, Notebook, TextAa } from "@phosphor-icons/react";
import { fetchFiles, fetchFile, type FileNode } from "../api";
import { useLocale } from "../hooks/useLocale";

interface DiaryEntry {
  date: string;
  path: string;
  title: string;
  preview: string;
  tags: string[];
  charCount: number;
}

interface MonthGroup {
  key: string;
  label: string;
  entries: DiaryEntry[];
  totalChars: number;
}

interface Props {
  onOpenFile: (path: string) => void;
}

function extractMeta(content: string, filename: string) {
  const clean = content.replace(/^---[\s\S]*?---/, "").trim();
  const titleMatch = clean.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : filename.replace(/\.md$/, "");

  // Preview: first meaningful paragraph after title
  const lines = clean.split("\n").filter(l => l.trim() && !l.startsWith("#"));
  let preview = lines.slice(0, 2).join(" ").replace(/[*_`\[\]]/g, "").trim();
  if (preview.length > 120) preview = preview.slice(0, 120) + "…";

  // Tags from ## headers
  const headers = content.match(/^##\s+(.+)$/gm) || [];
  const tags = headers
    .map(h => h.replace(/^##\s+/, "").replace(/[*_`]/g, "").trim())
    .filter(t => t.length < 20)
    .slice(0, 4);

  return { title, preview: preview || "(空)", tags, charCount: content.length };
}

function findDiaryFiles(nodes: FileNode[], base = ""): { name: string; path: string }[] {
  const results: { name: string; path: string }[] = [];
  for (const n of nodes) {
    const p = base ? `${base}/${n.name}` : n.path || n.name;
    if (n.type === "dir" && n.children && (n.name === "memory" || base.includes("memory"))) {
      results.push(...findDiaryFiles(n.children, p));
    } else if (n.type === "file" && /^\d{4}-\d{2}-\d{2}(-\w+)?\.md$/.test(n.name)) {
      results.push({ name: n.name, path: p });
    }
  }
  return results;
}

export function Timeline({ onOpenFile }: Props) {
  const { t, locale } = useLocale();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const tree = await fetchFiles();
        const diaries = findDiaryFiles(tree).slice(0, 100);
        setProgress({ done: 0, total: diaries.length });

        const loaded: DiaryEntry[] = [];
        // Load in batches of 5 for responsiveness
        for (let i = 0; i < diaries.length; i += 5) {
          const batch = diaries.slice(i, i + 5);
          const results = await Promise.all(
            batch.map(async (f) => {
              try {
                const data = await fetchFile(f.path);
                const date = f.name.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || "";
                const meta = extractMeta(data.content, f.name);
                return { date, path: f.path, ...meta } as DiaryEntry;
              } catch { return null; }
            })
          );
          loaded.push(...results.filter((r): r is DiaryEntry => r !== null));
          setProgress({ done: Math.min(i + 5, diaries.length), total: diaries.length });
          setEntries([...loaded]); // Progressive render
        }

        // Expand current month
        const now = new Date().toISOString().slice(0, 7);
        setExpanded(new Set([now]));
      } catch (e) {
        console.error("Timeline load failed:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!tagFilter) return entries;
    return entries.filter(e => e.tags.some(t => t.includes(tagFilter)));
  }, [entries, tagFilter]);

  const months = useMemo((): MonthGroup[] => {
    const map: Record<string, DiaryEntry[]> = {};
    for (const e of filtered) {
      const k = e.date.slice(0, 7);
      (map[k] ||= []).push(e);
    }
    const zhMonths = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
    const enMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([k, entries]) => {
        const [y, m] = k.split("-");
        const mi = parseInt(m) - 1;
        const label = locale.startsWith("zh") ? `${y} 年 ${zhMonths[mi]}` : `${enMonths[mi]} ${y}`;
        return {
          key: k,
          label,
          entries: entries.sort((a, b) => b.date.localeCompare(a.date)),
          totalChars: entries.reduce((s, e) => s + e.charCount, 0),
        };
      });
  }, [filtered, locale]);

  const allTags = useMemo(() => {
    const count: Record<string, number> = {};
    for (const e of entries) for (const t of e.tags) count[t] = (count[t] || 0) + 1;
    return Object.entries(count).sort(([, a], [, b]) => b - a).slice(0, 12);
  }, [entries]);

  const stats = useMemo(() => ({
    total: entries.length,
    chars: entries.reduce((s, e) => s + e.charCount, 0),
    months: new Set(entries.map(e => e.date.slice(0, 7))).size,
  }), [entries]);

  const toggle = (k: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(k) ? next.delete(k) : next.add(k);
    return next;
  });

  const weekday = (d: string) => {
    const days = locale.startsWith("zh")
      ? ["日", "一", "二", "三", "四", "五", "六"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[new Date(d + "T00:00:00").getDay()];
  };

  const fmtChars = (n: number) => n >= 10000 ? `${(n / 10000).toFixed(1)}万` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Stats bar */}
      <div className="flex items-center gap-6 mb-6 px-4 py-3 rounded-lg" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <Notebook size={18} className="text-blue-400" />
          <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{stats.total}</span>
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>{t("timeline.entries")}</span>
        </div>
        <div className="flex items-center gap-2">
          <TextAa size={18} className="text-green-400" />
          <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{fmtChars(stats.chars)}</span>
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>{t("timeline.chars")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-purple-400" />
          <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{stats.months}</span>
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>{t("timeline.months")}</span>
        </div>
        {loading && (
          <div className="ml-auto flex items-center gap-2 text-xs" style={{ color: "var(--text-faint)" }}>
            <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            {progress.done}/{progress.total}
          </div>
        )}
      </div>

      {/* Tags */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-5">
          <Hash size={14} style={{ color: "var(--text-faint)" }} />
          {tagFilter && (
            <button
              onClick={() => setTagFilter(null)}
              className="px-2 py-0.5 rounded-full text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors"
            >
              ✕ {tagFilter}
            </button>
          )}
          {allTags.map(([tag, count]) => (
            <button
              key={tag}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              className="px-2 py-0.5 rounded-full text-xs transition-colors"
              style={{
                background: tagFilter === tag ? "rgba(59,130,246,0.2)" : "var(--bg-secondary)",
                color: tagFilter === tag ? "#3b82f6" : "var(--text-muted)",
                border: `1px solid ${tagFilter === tag ? "#3b82f6" : "var(--border)"}`,
              }}
            >
              {tag}
              <span className="ml-1 opacity-50">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Month groups */}
      {months.length === 0 && !loading && (
        <div className="text-center py-16" style={{ color: "var(--text-faint)" }}>
          <Calendar size={40} className="mx-auto mb-3 opacity-30" />
          <p>{t("timeline.empty")}</p>
        </div>
      )}

      <div className="space-y-3">
        {months.map(group => (
          <div key={group.key} className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {/* Month header */}
            <button
              onClick={() => toggle(group.key)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold transition-colors"
              style={{ background: "var(--bg-secondary)", color: "var(--text-primary)" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={e => e.currentTarget.style.background = "var(--bg-secondary)"}
            >
              <div className="flex items-center gap-2">
                {expanded.has(group.key)
                  ? <CaretDown size={16} style={{ color: "var(--text-faint)" }} />
                  : <CaretRight size={16} style={{ color: "var(--text-faint)" }} />}
                {group.label}
              </div>
              <div className="flex items-center gap-3 text-xs font-normal" style={{ color: "var(--text-faint)" }}>
                <span>{fmtChars(group.totalChars)}</span>
                <span className="px-1.5 py-0.5 rounded-full" style={{ background: "var(--bg-tertiary)" }}>
                  {group.entries.length}
                </span>
              </div>
            </button>

            {/* Entries */}
            {expanded.has(group.key) && (
              <div>
                {group.entries.map((entry, i) => (
                  <button
                    key={entry.path}
                    onClick={() => onOpenFile(entry.path)}
                    className="w-full text-left flex items-start gap-3 px-4 py-3 transition-colors"
                    style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    {/* Date badge */}
                    <div className="shrink-0 w-12 text-center pt-0.5">
                      <div className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                        {entry.date.slice(8)}
                      </div>
                      <div className="text-[10px]" style={{ color: "var(--text-faint)" }}>
                        {weekday(entry.date)}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {entry.title}
                      </div>
                      <div className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                        {entry.preview}
                      </div>
                      {entry.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {entry.tags.map(tag => (
                            <span
                              key={tag}
                              className="text-[10px] px-1.5 py-0.5 rounded"
                              style={{ background: "var(--bg-tertiary)", color: "var(--text-faint)" }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Char count */}
                    <div className="shrink-0 text-[11px] pt-1" style={{ color: "var(--text-faint)" }}>
                      {fmtChars(entry.charCount)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
