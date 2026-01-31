import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { fetchFile, saveFile } from "../api";
import { Pencil, Save, X, Check, AlertCircle, ChevronRight, ArrowUp, Copy } from "lucide-react";
import { SensitiveText } from "./SensitiveMask";

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
function CodeBlock({ className, children, ...props }: any) {
  const [copied, setCopied] = useState(false);
  const isBlock = className?.startsWith("language-");
  if (!isBlock) {
    if (typeof children === "string") {
      return <code {...props}><SensitiveText>{children}</SensitiveText></code>;
    }
    return <code {...props}>{children}</code>;
  }
  const text = String(children).replace(/\n$/, "");
  return (
    <code className={className} {...props}>
      <button
        className="code-copy-btn"
        onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        title="Copy"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      {children}
    </code>
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
  const [content, setContent] = useState("");
  const [editContent, setEditContent] = useState("");
  const [mtime, setMtime] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const editorRef = useRef<HTMLTextAreaElement>(null);
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
      .catch(() => showToast("Failed to load"))
      .finally(() => setLoading(false));
  }, [filePath, refreshKey]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const hasChanges = editing && editContent !== content;

  const handleSave = useCallback(async () => {
    try {
      const result = await saveFile(filePath, editContent);
      if (result.ok) {
        setContent(editContent);
        setMtime(result.mtime);
        setEditing(false);
        showToast("Saved");
      }
    } catch {
      showToast("Save failed");
    }
  }, [filePath, editContent]);

  const handleCancel = () => {
    if (hasChanges && !confirm("Discard unsaved changes?")) return;
    setEditContent(content);
    setEditing(false);
  };

  const handleEdit = () => {
    setEditing(true);
    setTimeout(() => editorRef.current?.focus(), 50);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s" && editing) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editing, handleSave]);

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
        Loading…
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
            <span>{fileStats.words} words</span>
          </span>
          <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={handleSave} className="btn-primary text-sm flex items-center gap-1">
                <Save className="w-3.5 h-3.5" /> Save
              </button>
              <button onClick={handleCancel} className="btn-secondary text-sm flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            </>
          ) : (
            <button onClick={handleEdit} className="btn-secondary text-sm flex items-center gap-1">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 relative" ref={contentRef} onScroll={handleScroll}>
        {editing ? (
          <textarea
            ref={editorRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="editor-textarea"
            style={{ minHeight: "100%" }}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                e.preventDefault();
                const t = e.currentTarget;
                const s = t.selectionStart;
                const end = t.selectionEnd;
                setEditContent(editContent.substring(0, s) + "  " + editContent.substring(end));
                setTimeout(() => { t.selectionStart = t.selectionEnd = s + 2; }, 0);
              }
            }}
          />
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
        <button onClick={scrollToTop} className="scroll-top-btn" title="Back to top">
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
