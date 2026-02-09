import { useEffect, useMemo, useState } from "react";
import { Calendar, FileText, CaretDown, CaretRight, Clock, Hash } from "@phosphor-icons/react";
import { fetchFiles, fetchFile, type FileNode } from "../api";
import { useLocale } from "../hooks/useLocale";

interface DiaryEntry {
  date: string;
  path: string;
  title: string;
  preview: string;
  tags: string[];
  wordCount: number;
}

interface MonthGroup {
  monthKey: string; // YYYY-MM
  monthLabel: string;
  entries: DiaryEntry[];
}

interface Props {
  onOpenFile: (path: string) => void;
}

function extractTitle(content: string, filename: string): string {
  // Try to find first heading
  const match = content.match(/^#\s+(.+)$/m);
  if (match) return match[1].trim();
  // Fall back to filename
  return filename.replace(/\.md$/, "");
}

function extractTags(content: string): string[] {
  // Extract hashtags and section headers
  const tags: string[] = [];
  const hashtagMatches = content.match(/#[\w\u4e00-\u9fa5]+/g);
  if (hashtagMatches) {
    tags.push(...hashtagMatches.map(t => t.slice(1)));
  }
  // Also count section headers as tags
  const sectionMatches = content.match(/^##\s+(.+)$/gm);
  if (sectionMatches) {
    tags.push(...sectionMatches.map(s => s.replace(/^##\s+/, "").trim()));
  }
  return [...new Set(tags)].slice(0, 5);
}

function getPreview(content: string, maxLength = 150): string {
  // Remove frontmatter
  let clean = content.replace(/^---[\s\S]*?---/, "").trim();
  // Remove markdown syntax
  clean = clean.replace(/#+\s+/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`]/g, "");
  // Get first non-empty line
  const lines = clean.split("\n").filter(l => l.trim());
  if (!lines.length) return "(空)";
  const firstLine = lines[0].trim();
  if (firstLine.length > maxLength) return firstLine.slice(0, maxLength) + "...";
  return firstLine;
}

function formatDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const weekdays = locale.startsWith("zh") 
    ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekday = weekdays[date.getDay()];
  const day = date.getDate();
  return `${day}日 ${weekday}`;
}

function groupByMonth(entries: DiaryEntry[], locale: string): MonthGroup[] {
  const groups: Record<string, DiaryEntry[]> = {};
  
  for (const entry of entries) {
    const monthKey = entry.date.slice(0, 7); // YYYY-MM
    if (!groups[monthKey]) groups[monthKey] = [];
    groups[monthKey].push(entry);
  }
  
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a)) // Newest first
    .map(([monthKey, entries]) => {
      const [year, month] = monthKey.split("-");
      const monthNames = locale.startsWith("zh")
        ? ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"]
        : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return {
        monthKey,
        monthLabel: locale.startsWith("zh") 
          ? `${year}年${monthNames[parseInt(month) - 1]}`
          : `${monthNames[parseInt(month) - 1]} ${year}`,
        entries: entries.sort((a, b) => b.date.localeCompare(a.date)),
      };
    });
}

export function Timeline({ onOpenFile }: Props) {
  const { t, locale } = useLocale();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [searchTag, setSearchTag] = useState<string | null>(null);

  useEffect(() => {
    loadDiaries();
  }, []);

  async function loadDiaries() {
    setLoading(true);
    try {
      const files = await fetchFiles();
      const diaryFiles = findDiaryFiles(files);
      
      // Load content for each diary
      const loadedEntries: DiaryEntry[] = [];
      for (const file of diaryFiles.slice(0, 100)) { // Limit to recent 100
        try {
          const data = await fetchFile(file.path);
          const date = file.path.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || "";
          loadedEntries.push({
            date,
            path: file.path,
            title: extractTitle(data.content, file.name),
            preview: getPreview(data.content),
            tags: extractTags(data.content),
            wordCount: data.content.length,
          });
        } catch (e) {
          console.error("Failed to load:", file.path, e);
        }
      }
      
      setEntries(loadedEntries);
      // Expand first 3 months by default
      const first3Months = [...new Set(loadedEntries.map(e => e.date.slice(0, 7)))].slice(0, 3);
      setExpandedMonths(new Set(first3Months));
    } catch (e) {
      console.error("Failed to load diaries:", e);
    } finally {
      setLoading(false);
    }
  }

  function findDiaryFiles(files: FileNode[], basePath = ""): FileNode[] {
    const results: FileNode[] = [];
    for (const f of files) {
      const fullPath = basePath ? `${basePath}/${f.name}` : f.path || f.name;
      if (f.type === "dir" && f.children) {
        if (f.name === "memory" || fullPath.includes("memory")) {
          results.push(...findDiaryFiles(f.children, fullPath));
        }
      } else if (f.type === "file" && f.name.match(/^\d{4}-\d{2}-\d{2}\.md$/)) {
        results.push({ ...f, path: fullPath });
      }
    }
    return results;
  }

  const filteredEntries = useMemo(() => {
    if (!searchTag) return entries;
    return entries.filter(e => e.tags.some(t => t.toLowerCase().includes(searchTag.toLowerCase())));
  }, [entries, searchTag]);

  const monthGroups = useMemo(() => {
    return groupByMonth(filteredEntries, locale);
  }, [filteredEntries, locale]);

  const allTags = useMemo(() => {
    const tagCount: Record<string, number> = {};
    for (const e of entries) {
      for (const t of e.tags) {
        tagCount[t] = (tagCount[t] || 0) + 1;
      }
    }
    return Object.entries(tagCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 15)
      .map(([tag]) => tag);
  }, [entries]);

  const stats = useMemo(() => ({
    totalEntries: entries.length,
    totalWords: entries.reduce((s, e) => s + e.wordCount, 0),
    totalTags: allTags.length,
  }), [entries, allTags]);

  function toggleMonth(monthKey: string) {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  }

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>
        <div className="animate-spin" style={{ marginBottom: "1rem" }}>
          <Clock size={32} />
        </div>
        {t("timeline.loading")}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "1rem" }}>
      {/* Header Stats */}
      <div style={{ 
        display: "flex", 
        gap: "1.5rem", 
        marginBottom: "1.5rem",
        padding: "1rem",
        background: "var(--bg-secondary)",
        borderRadius: "12px",
        border: "1px solid var(--border-color)",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent)" }}>{stats.totalEntries}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{t("timeline.entries")}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent)" }}>
            {stats.totalWords > 10000 ? `${(stats.totalWords / 10000).toFixed(1)}w` : stats.totalWords}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{t("timeline.words")}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent)" }}>{stats.totalTags}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{t("timeline.tags")}</div>
        </div>
      </div>

      {/* Tag Filter */}
      {allTags.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            <Hash size={14} />
            {t("timeline.filterByTag")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {searchTag && (
              <button
                onClick={() => setSearchTag(null)}
                style={{
                  padding: "0.25rem 0.75rem",
                  borderRadius: "9999px",
                  border: "none",
                  background: "var(--accent)",
                  color: "#fff",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                ✕ {searchTag}
              </button>
            )}
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSearchTag(tag)}
                style={{
                  padding: "0.25rem 0.75rem",
                  borderRadius: "9999px",
                  border: "1px solid var(--border-color)",
                  background: searchTag === tag ? "var(--accent)" : "var(--bg-secondary)",
                  color: searchTag === tag ? "#fff" : "var(--text-secondary)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {monthGroups.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>
            <Calendar size={48} style={{ marginBottom: "1rem", opacity: 0.5 }} />
            <p>{searchTag ? t("timeline.noResults") : t("timeline.empty")}</p>
          </div>
        ) : (
          monthGroups.map(group => (
            <div key={group.monthKey} style={{ border: "1px solid var(--border-color)", borderRadius: "12px", overflow: "hidden" }}>
              {/* Month Header */}
              <button
                onClick={() => toggleMonth(group.monthKey)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.75rem 1rem",
                  background: "var(--bg-secondary)",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-primary)",
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Calendar size={18} style={{ color: "var(--accent)" }} />
                  {group.monthLabel}
                  <span style={{ 
                    marginLeft: "0.5rem",
                    padding: "0.125rem 0.5rem",
                    background: "var(--bg-primary)",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                    color: "var(--text-secondary)",
                  }}>
                    {group.entries.length}
                  </span>
                </div>
                {expandedMonths.has(group.monthKey) ? <CaretDown size={18} /> : <CaretRight size={18} />}
              </button>

              {/* Month Entries */}
              {expandedMonths.has(group.monthKey) && (
                <div style={{ padding: "0.5rem" }}>
                  {group.entries.map((entry, idx) => (
                    <div
                      key={entry.date}
                      onClick={() => onOpenFile(entry.path)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.75rem",
                        padding: "0.75rem",
                        borderRadius: "8px",
                        cursor: "pointer",
                        background: idx % 2 === 0 ? "var(--bg-primary)" : "transparent",
                        borderBottom: idx < group.entries.length - 1 ? "1px solid var(--border-color)" : "none",
                      }}
                    >
                      {/* Date */}
                      <div style={{ 
                        minWidth: "70px",
                        textAlign: "center",
                        padding: "0.5rem",
                        background: "var(--bg-secondary)",
                        borderRadius: "8px",
                      }}>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                          {entry.date.slice(5, 7)}/{entry.date.slice(8, 10)}
                        </div>
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          fontWeight: 600, 
                          marginBottom: "0.25rem",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {entry.title}
                        </div>
                        <div style={{ 
                          fontSize: "0.8125rem", 
                          color: "var(--text-secondary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {entry.preview}
                        </div>
                        {entry.tags.length > 0 && (
                          <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                            {entry.tags.slice(0, 3).map(tag => (
                              <span key={tag} style={{
                                fontSize: "0.6875rem",
                                padding: "0.125rem 0.375rem",
                                background: "var(--bg-secondary)",
                                borderRadius: "4px",
                                color: "var(--text-tertiary)",
                              }}>
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Word count */}
                      <div style={{ 
                        fontSize: "0.75rem", 
                        color: "var(--text-tertiary)",
                        whiteSpace: "nowrap",
                      }}>
                        {entry.wordCount > 1000 
                          ? `${(entry.wordCount / 1000).toFixed(1)}k` 
                          : entry.wordCount} {t("timeline.chars")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
