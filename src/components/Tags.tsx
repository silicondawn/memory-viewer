import { useEffect, useMemo, useState } from "react";
import { Hash, FileText, CaretRight, Clock, Tag as TagIcon, X } from "@phosphor-icons/react";
import { fetchTags, fetchFilesByTag, type TagInfo, type FileWithTags } from "../api";
import { useLocale } from "../hooks/useLocale";

interface Props {
  onOpenFile: (path: string) => void;
}

export function Tags({ onOpenFile }: Props) {
  const { t } = useLocale();
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [files, setFiles] = useState<FileWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [filesLoading, setFilesLoading] = useState(false);

  // Load all tags on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchTags();
        setTags(data);
      } catch (e) {
        console.error("Tags load failed:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load files when tag selected
  useEffect(() => {
    if (!selectedTag) {
      setFiles([]);
      return;
    }
    (async () => {
      setFilesLoading(true);
      try {
        const data = await fetchFilesByTag(selectedTag);
        setFiles(data);
      } catch (e) {
        console.error("Files by tag load failed:", e);
      } finally {
        setFilesLoading(false);
      }
    })();
  }, [selectedTag]);

  // Calculate tag sizes for cloud display
  const tagSizes = useMemo(() => {
    if (tags.length === 0) return [];
    const maxCount = Math.max(...tags.map(t => t.count));
    const minCount = Math.min(...tags.map(t => t.count));
    const range = maxCount - minCount || 1;

    return tags.map(tag => {
      // Normalize to 1-5 scale
      const size = 1 + ((tag.count - minCount) / range) * 4;
      return { ...tag, size: Math.round(size) };
    });
  }, [tags]);

  // Group tags by first letter/category
  const groupedTags = useMemo(() => {
    const groups: Record<string, typeof tags> = {};
    for (const tag of tags) {
      const firstChar = tag.name.charAt(0);
      const key = /[\u4e00-\u9fa5]/.test(firstChar) ? "中文" :
                  /[a-zA-Z]/.test(firstChar) ? firstChar.toUpperCase() :
                  "#";
      (groups[key] ||= []).push(tag);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [tags]);

  const stats = useMemo(() => ({
    totalTags: tags.length,
    totalFiles: tags.reduce((s, t) => s + t.count, 0),
    avgPerTag: tags.length > 0 ? (tags.reduce((s, t) => s + t.count, 0) / tags.length).toFixed(1) : "0",
  }), [tags]);

  // Get color based on tag size
  const getTagColor = (size: number) => {
    const colors = [
      "var(--text-faint)",
      "var(--text-muted)",
      "var(--text-secondary)",
      "var(--accent)",
      "#3b82f6",
    ];
    return colors[size - 1] || colors[0];
  };

  const getTagSize = (size: number) => {
    const sizes = ["0.75rem", "0.875rem", "1rem", "1.125rem", "1.25rem"];
    return sizes[size - 1] || sizes[0];
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
            <TagIcon size={24} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              {t("tags.title", "标签")}
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {t("tags.subtitle", "按主题浏览记忆")}
            </p>
          </div>
        </div>

        {selectedTag && (
          <button
            onClick={() => setSelectedTag(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
            onMouseLeave={e => e.currentTarget.style.background = "var(--bg-secondary)"}
          >
            <X size={14} />
            {t("tags.clear", "清除筛选")}
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 mb-6 px-4 py-3 rounded-lg" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <TagIcon size={18} className="text-blue-400" />
          <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{stats.totalTags}</span>
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>{t("tags.totalTags", "标签")}</span>
        </div>
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-green-400" />
          <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{stats.totalFiles}</span>
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>{t("tags.totalFiles", "文件")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Hash size={18} className="text-purple-400" />
          <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{stats.avgPerTag}</span>
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>{t("tags.avgPerTag", "平均")}</span>
        </div>
        {loading && (
          <div className="ml-auto w-4 h-4 border-2 border-t-blue-400 rounded-full animate-spin" style={{ borderColor: "var(--border)" }} />
        )}
      </div>

      {/* Selected tag files view */}
      {selectedTag ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>{t("tags.showing", "显示标签")}</span>
            <span className="px-3 py-1 rounded-full text-sm font-medium text-white bg-blue-500">
              {selectedTag}
            </span>
            <span className="text-sm" style={{ color: "var(--text-faint)" }}>
              ({files.length} {t("tags.files", "个文件")})
            </span>
          </div>

          {filesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-t-blue-400 rounded-full animate-spin" style={{ borderColor: "var(--border)" }} />
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12" style={{ color: "var(--text-faint)" }}>
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p>{t("tags.noFiles", "没有找到相关文件")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file, i) => (
                <button
                  key={file.path}
                  onClick={() => onOpenFile(file.path)}
                  className="w-full text-left p-4 rounded-lg transition-colors"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                  onMouseLeave={e => e.currentTarget.style.background = "var(--bg-secondary)"}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText size={16} style={{ color: "var(--accent)" }} />
                        <span className="font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {file.title}
                        </span>
                      </div>
                      <p className="text-sm truncate" style={{ color: "var(--text-muted)" }}>
                        {file.preview}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {file.tags.map(tag => (
                          <span
                            key={tag}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTag(tag);
                            }}
                            className="text-[11px] px-2 py-0.5 rounded-full cursor-pointer transition-colors"
                            style={{
                              background: tag === selectedTag ? "rgba(59,130,246,0.2)" : "var(--bg-tertiary)",
                              color: tag === selectedTag ? "#3b82f6" : "var(--text-faint)",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    {file.date && (
                      <div className="shrink-0 text-xs" style={{ color: "var(--text-faint)" }}>
                        {file.date}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Tag cloud view */
        <div className="space-y-6">
          {/* Popular tags cloud */}
          {tagSizes.length > 0 && (
            <div className="p-5 rounded-lg" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                <Hash size={16} />
                {t("tags.popular", "热门标签")}
              </h2>
              <div className="flex flex-wrap gap-2">
                {tagSizes.slice(0, 30).map(({ name, count, size }) => (
                  <button
                    key={name}
                    onClick={() => setSelectedTag(name)}
                    className="px-3 py-1.5 rounded-full transition-all hover:scale-105"
                    style={{
                      fontSize: getTagSize(size),
                      color: getTagColor(size),
                      background: size >= 4 ? "rgba(59,130,246,0.1)" : "var(--bg-tertiary)",
                      border: `1px solid ${size >= 4 ? "rgba(59,130,246,0.3)" : "var(--border)"}`,
                    }}
                    title={`${count} ${t("tags.files", "个文件")}`}
                  >
                    {name}
                    <span className="ml-1 opacity-50 text-xs">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Grouped tags list */}
          <div className="space-y-4">
            {groupedTags.map(([key, groupTags]) => (
              <div key={key} className="p-4 rounded-lg" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "var(--text-faint)" }}>
                  <span className="w-5 h-5 flex items-center justify-center rounded" style={{ background: "var(--bg-tertiary)" }}>
                    {key}
                  </span>
                  <span>{groupTags.length} {t("tags.tags", "个标签")}</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {groupTags.map(({ name, count }) => (
                    <button
                      key={name}
                      onClick={() => setSelectedTag(name)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm transition-colors"
                      style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "var(--accent)";
                        e.currentTarget.style.color = "white";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "var(--bg-tertiary)";
                        e.currentTarget.style.color = "var(--text-muted)";
                      }}
                    >
                      <Hash size={12} />
                      {name}
                      <span className="text-[10px] opacity-60 px-1 rounded" style={{ background: "rgba(0,0,0,0.2)" }}>
                        {count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {tags.length === 0 && !loading && (
            <div className="text-center py-16" style={{ color: "var(--text-faint)" }}>
              <TagIcon size={48} className="mx-auto mb-3 opacity-30" />
              <p>{t("tags.empty", "暂无标签")}</p>
              <p className="text-sm mt-1">{t("tags.emptyHint", "在 Markdown 中使用 ## 标题 或 #标签 来创建标签")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
