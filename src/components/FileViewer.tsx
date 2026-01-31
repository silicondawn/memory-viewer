import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { fetchFile, saveFile, ConflictResult } from "../api";
import { Pencil, Save, X, Check, AlertCircle, ChevronRight, ArrowUp, Copy, AlertTriangle, RefreshCw } from "lucide-react";
import { SensitiveText } from "./SensitiveMask";
import { useLocale } from "../hooks/useLocale";
import { lazy, Suspense } from "react";
const MarkdownEditor = lazy(() => import("./MarkdownEditor").then(m => ({ default: m.MarkdownEditor })));

/** Extract YAML front matter and return { meta, body } */
function parseFrontMatter(raw: string): { meta: Record<string, string> | null; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: null, body: raw };
  const yamlBlock = match[1];
  const body = match[2];
  const meta: Record<string, string> = {};
  for (const line of yamlBlock.split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
      if (key && val) meta[key] = val;
    }
  }
  return { meta: Object.keys(meta).length ? meta : null, body };
}

/** Recursively wrap string children with SensitiveText */
function maskChildren(children: React.ReactNode): React.ReactNode {
  if (typeof children === "string") return <SensitiveText>{children}</SensitiveText>;
  if (Array.isArray(children)) return children.map((c, i) =>
    typeof c === "string" ? <SensitiveText key={i}>{c}</SensitiveText> : c
  );
  return children;
}

/** Code block with copy button */
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { materialOceanic } from "react-syntax-highlighter/dist/esm/styles/prism";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

function CodeBlock({ className, children, ...props }: any) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const text = String(children).replace(/\n$/, "");
  const isBlock = !!match || text.includes("\n");
  if (!isBlock) {
    if (typeof children === "string") {
      return <code {...props}><SensitiveText>{children}</SensitiveText></code>;
    }
    return <code {...props}>{children}</code>;
  }
  const isDark = document.documentElement.classList.contains("dark");
  // Plain text code blocks (no language) - use simple <pre> for uniform background
  if (!match) {
    return (
      <div className="relative group">
        <button
          className="code-copy-btn"
          onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          title={t("file.copy")}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        <pre style={{
          margin: 0,
          borderRadius: "0.75rem",
          fontSize: "0.85rem",
          lineHeight: "1.7",
          border: `1px solid var(--pre-border)`,
          padding: "1rem",
          background: "var(--pre-bg)",
          color: "var(--pre-text)",
          fontFamily: "Menlo, Consolas, 'DejaVu Sans Mono', 'Liberation Mono', monospace",
          overflowX: "auto",
          whiteSpace: "pre",
        }}>
          <code style={{ background: "transparent", fontFamily: "inherit" }}>{text}</code>
        </pre>
      </div>
    );
  }
  return (
    <div className="relative group">
      <button
        className="code-copy-btn"
        onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        title={t("file.copy")}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      <SyntaxHighlighter
        style={isDark ? materialOceanic : oneLight}
        language={match[1]}
        showLineNumbers
        wrapLines
        PreTag="div"
        lineProps={{ style: { background: "transparent" } }}
        customStyle={{
          margin: 0,
          borderRadius: "0.75rem",
          fontSize: "0.85rem",
          lineHeight: "1.7",
          border: `1px solid var(--pre-border)`,
          padding: "1rem",
          background: "var(--pre-bg)",
        }}
        codeTagProps={{
          style: { fontFamily: "'JetBrains Mono', 'Fira Code', monospace", background: "transparent" },
        }}
        lineNumberStyle={{
          minWidth: "2.5em",
          paddingRight: "1em",
          color: "var(--text-faint)",
          opacity: 0.5,
          fontSize: "0.8rem",
          userSelect: "none",
        }}
      >
        {text}
      </SyntaxHighlighter>
    </div>
  );
}

/** Breadcrumb path */
function Breadcrumb({ path, hasChanges, onNavigate }: { path: string; hasChanges: boolean; onNavigate?: (dir: string) => void }) {
  const parts = path.split("/");
  return (
    <span className={`font-medium flex items-center flex-wrap gap-0.5 min-w-0 ${hasChanges ? "text-yellow-400" : ""}`} style={hasChanges ? {} : { color: "var(--text-primary)" }}>
      {hasChanges && "● "}
      {parts.map((part, i) => {
        const isLast = i === parts.length - 1;
        const dir = parts.slice(0, i + 1).join("/");
        return (
          <span key={i} className="flex items-center gap-0.5">
            {i > 0 && <ChevronRight className="w-3 h-3 shrink-0" style={{ color: "var(--text-faint)" }} />}
            {isLast ? (
              <span className="truncate">{part}</span>
            ) : (
              <button
                className="hover:text-blue-400 transition-colors truncate"
                onClick={() => onNavigate?.(dir)}
              >
                {part}
              </button>
            )}
          </span>
        );
      })}
    </span>
  );
}

interface FileViewerProps {
  filePath: string;
  refreshKey?: number;
  onNavigate?: (dir: string) => void;
}

export function FileViewer({ filePath, refreshKey, onNavigate }: FileViewerProps) {
  const { t } = useLocale();
  const [content, setContent] = useState("");
  const [editContent, setEditContent] = useState("");
  const [mtime, setMtime] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [conflict, setConflict] = useState<ConflictResult | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    setLoading(true);
    setEditing(false);
    fetchFile(filePath)
      .then((data) => {
        setContent(data.content);
        setEditContent(data.content);
        setMtime(data.mtime);
      })
      .catch(() => showToast(t("file.failedToLoad")))
      .finally(() => setLoading(false));
  }, [filePath, refreshKey]);

  // Auto-refresh every 10s when not editing (for when WebSocket is unavailable)
  useEffect(() => {
    if (editing) return;
    const interval = setInterval(() => {
      fetchFile(filePath).then((data) => {
        if (data.mtime !== mtime) {
          setContent(data.content);
          setEditContent(data.content);
          setMtime(data.mtime);
        }
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [filePath, editing, mtime]);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFile(filePath)
      .then((data) => {
        setContent(data.content);
        setEditContent(data.content);
        setMtime(data.mtime);
        showToast(t("file.reloaded") || "Refreshed");
      })
      .catch(() => showToast(t("file.failedToLoad")))
      .finally(() => setRefreshing(false));
  }, [filePath]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const hasChanges = editing && editContent !== content;

  const handleSave = useCallback(async (force = false) => {
    try {
      const result = await saveFile(filePath, editContent, force ? undefined : mtime);
      if ("error" in result && result.error === "conflict") {
        setConflict(result as ConflictResult);
        return;
      }
      if ("ok" in result && result.ok) {
        setContent(editContent);
        setMtime(result.mtime);
        setEditing(false);
        setConflict(null);
        showToast(t("file.saved"));
      }
    } catch {
      showToast(t("file.saveFailed"));
    }
  }, [filePath, editContent, mtime]);

  const handleConflictOverwrite = useCallback(() => {
    handleSave(true);
  }, [handleSave]);

  const handleConflictReload = useCallback(() => {
    if (conflict) {
      setContent(conflict.serverContent);
      setEditContent(conflict.serverContent);
      setMtime(conflict.serverMtime);
      setConflict(null);
      showToast(t("file.reloaded"));
    }
  }, [conflict]);

  const handleCancel = () => {
    if (hasChanges && !confirm(t("file.discardChanges"))) return;
    setEditContent(content);
    setEditing(false);
  };

  const isDark = useMemo(() => {
    return document.documentElement.classList.contains("dark");
  }, [editing]);

  const handleEdit = () => {
    setEditing(true);
  };

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChanges) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  const frontMatter = useMemo(() => parseFrontMatter(content), [content]);

  const fileStats = useMemo(() => {
    const bytes = new Blob([content]).size;
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const sizeStr = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
    return { sizeStr, words };
  }, [content]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setShowScrollTop(e.currentTarget.scrollTop > 300);
  }, []);

  const scrollToTop = () => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "var(--text-faint)" }}>
        <div className="w-5 h-5 border-2 border-t-blue-400 rounded-full animate-spin mr-3" style={{ borderColor: "var(--border)" }} />
        {t("file.loading")}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b backdrop-blur shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <div className="min-w-0 flex items-center gap-3">
          <Breadcrumb path={filePath} hasChanges={hasChanges} onNavigate={onNavigate} />
          <span className="text-xs hidden sm:inline" style={{ color: "var(--text-faint)" }}>
            {new Date(mtime).toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs hidden sm:flex gap-2" style={{ color: "var(--text-faint)" }}>
            <span>{fileStats.sizeStr}</span>
            <span>·</span>
            <span>{fileStats.words} {t("file.words")}</span>
          </span>
          <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={handleSave} className="btn-primary text-sm flex items-center gap-1">
                <Save className="w-3.5 h-3.5" /> {t("file.save")}
              </button>
              <button onClick={handleCancel} className="btn-secondary text-sm flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> {t("file.cancel")}
              </button>
            </>
          ) : (
            <>
              <button onClick={handleRefresh} className="btn-secondary text-sm flex items-center gap-1" disabled={refreshing} title="Refresh file">
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              </button>
              <button onClick={handleEdit} className="btn-secondary text-sm flex items-center gap-1">
                <Pencil className="w-3.5 h-3.5" /> {t("file.edit")}
              </button>
            </>
          )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 relative" ref={contentRef} onScroll={handleScroll}>
        {editing ? (
          <Suspense fallback={<div style={{ padding: 20, color: "var(--text-muted)" }}>Loading editor...</div>}>
            <MarkdownEditor
              value={editContent}
              onChange={setEditContent}
              onSave={handleSave}
              dark={isDark}
            />
          </Suspense>
        ) : (
          <article className="markdown-body max-w-3xl mx-auto">
            {frontMatter.meta && (
              <div className="mb-6 p-4 rounded-lg" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
                {frontMatter.meta.name && (
                  <h2 className="text-lg font-bold text-blue-400 mb-1">{frontMatter.meta.name}</h2>
                )}
                {frontMatter.meta.description && (
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{frontMatter.meta.description}</p>
                )}
                {Object.entries(frontMatter.meta)
                  .filter(([k]) => k !== "name" && k !== "description")
                  .map(([k, v]) => (
                    <span key={k} className="inline-block text-xs rounded px-2 py-0.5 mr-2 mt-2" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                      {k}: {v}
                    </span>
                  ))}
              </div>
            )}
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkFrontmatter]}
              components={{
                pre({ children }) {
                  // SyntaxHighlighter handles its own <pre>, so just pass through
                  return <>{children}</>;
                },
                code: CodeBlock,
                // Mask in plain text nodes within paragraphs
                p({ children }) {
                  return <p>{maskChildren(children)}</p>;
                },
                li({ children }) {
                  return <li>{maskChildren(children)}</li>;
                },
                td({ children }) {
                  return <td>{maskChildren(children)}</td>;
                },
              }}
            >{content}</ReactMarkdown>
          </article>
        )}
      </div>

      {/* Scroll to top */}
      {showScrollTop && !editing && (
        <button onClick={scrollToTop} className="scroll-top-btn" title={t("file.backToTop")}>
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      {/* Conflict Dialog */}
      {conflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-yellow-400 shrink-0" />
              <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{t("file.conflictTitle")}</h3>
            </div>
            <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
              {t("file.conflictDesc")}
            </p>
            <p className="text-xs mb-5" style={{ color: "var(--text-faint)" }}>
              {t("file.conflictTime")}: {new Date(conflict.serverMtime).toLocaleString()}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConflict(null)} className="btn-secondary text-sm">
                {t("file.cancel")}
              </button>
              <button onClick={handleConflictReload} className="btn-secondary text-sm">
                {t("file.conflictReload")}
              </button>
              <button onClick={handleConflictOverwrite} className="btn-primary text-sm">
                {t("file.conflictOverwrite")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
