import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import rehypeRaw from "rehype-raw";
import { fetchFile, saveFile, fetchBacklinks, resolveWikilink, ConflictResult, BacklinkEntry } from "../api";
import { Pencil, Save, X, Check, AlertCircle, ChevronRight, ArrowUp, Copy, AlertTriangle, RefreshCw, Link2, PenTool, Box } from "lucide-react";
import { SensitiveText } from "./SensitiveMask";
import { useLocale } from "../hooks/useLocale";
import { lazy, Suspense } from "react";
import { renderMermaid, THEMES } from "beautiful-mermaid";
import mermaid from "mermaid";
const MarkdownEditor = lazy(() => import("./MarkdownEditor").then(m => ({ default: m.MarkdownEditor })));

// Initialize mermaid for different styles
function initMermaid(isDark: boolean, handDrawn: boolean) {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme: isDark ? "dark" : "default",
    look: handDrawn ? "handDrawn" : "classic",
    fontFamily: handDrawn 
      ? "Virgil, Segoe Print, Bradley Hand, Chilanka, TSCu_Comic, casual, cursive"
      : "Inter, sans-serif",
  });
}

type MermaidStyle = "normal" | "handDrawn";

/** Mermaid diagram renderer with style toggle */
function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [style, setStyle] = useState<MermaidStyle>("normal");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    // Generate unique ID for each render to avoid conflicts
    const renderId = `mermaid-${Math.random().toString(36).slice(2)}`;
    
    if (style === "handDrawn") {
      // Use native mermaid with hand-drawn look
      initMermaid(isDark, true);
      console.log("[Mermaid] Rendering hand-drawn style with ID:", renderId);
      mermaid.render(renderId, code)
        .then((result) => {
          console.log("[Mermaid] Render success, svg length:", result.svg?.length);
          setSvg(result.svg);
          setError("");
        })
        .catch((e) => {
          console.error("[Mermaid] Render failed:", e);
          setError(e.message || "Failed to render diagram");
          setSvg("");
        });
    } else {
      // Use beautiful-mermaid for normal style
      const baseTheme = isDark ? THEMES["github-dark"] : THEMES["github-light"];
      const theme = { ...baseTheme, bg: "transparent" };
      renderMermaid(code, theme)
        .then((result) => {
          setSvg(typeof result === "string" ? result : (result as any).svg || String(result));
          setError("");
        })
        .catch((e) => {
          setError(e.message || "Failed to render diagram");
          setSvg("");
        });
    }
  }, [code, style]);

  if (error) {
    return (
      <div className="p-4 rounded-xl text-sm" style={{ background: "var(--pre-bg)", border: "1px solid var(--pre-border)", color: "var(--text-muted)" }}>
        <div className="mb-2 text-red-400">⚠ Mermaid render error: {error}</div>
        <pre style={{ whiteSpace: "pre-wrap", color: "var(--pre-text)" }}>{code}</pre>
      </div>
    );
  }

  if (!svg) {
    return <div className="p-4 text-sm" style={{ color: "var(--text-faint)" }}>Rendering diagram...</div>;
  }

  return (
    <div className="relative my-4">
      {/* Style toggle button */}
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <button
          onClick={() => setStyle("normal")}
          className={`p-1.5 rounded-md transition-colors ${
            style === "normal" 
              ? "bg-blue-500/20 text-blue-400" 
              : "bg-gray-500/10 text-gray-400 hover:bg-gray-500/20"
          }`}
          title="Normal style"
        >
          <Box size={14} />
        </button>
        <button
          onClick={() => setStyle("handDrawn")}
          className={`p-1.5 rounded-md transition-colors ${
            style === "handDrawn" 
              ? "bg-blue-500/20 text-blue-400" 
              : "bg-gray-500/10 text-gray-400 hover:bg-gray-500/20"
          }`}
          title="Hand-drawn style"
        >
          <PenTool size={14} />
        </button>
      </div>
      <div
        ref={containerRef}
        className="overflow-x-auto flex justify-center"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

/** Extract YAML front matter and return { meta, body } */
interface FrontMatterResult {
  meta: Record<string, string> | null;
  metadata: Record<string, any> | null;
  body: string;
}

function parseFrontMatter(raw: string): FrontMatterResult {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: null, metadata: null, body: raw };
  const yamlBlock = match[1];
  const body = match[2];
  const meta: Record<string, string> = {};
  let metadata: Record<string, any> | null = null;
  for (const line of yamlBlock.split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!key || !val) continue;
      if (key === "metadata") {
        try { metadata = JSON.parse(val); } catch { meta[key] = val; }
      } else {
        meta[key] = val;
      }
    }
  }
  return { meta: Object.keys(meta).length ? meta : null, metadata, body };
}

/** Recursively wrap string children with SensitiveText and WikiLinks */
function maskChildren(children: React.ReactNode, onOpenFile?: (path: string) => void): React.ReactNode {
  if (typeof children === "string") {
    // Check for wikilinks first
    if (children.includes("[[")) {
      const parts = processWikiLinks(children, onOpenFile);
      return parts.map((part, i) =>
        typeof part === "string" ? <SensitiveText key={i}>{part}</SensitiveText> : part
      );
    }
    return <SensitiveText>{children}</SensitiveText>;
  }
  if (Array.isArray(children)) return children.map((c, i) =>
    typeof c === "string" ? (
      c.includes("[[") ? (
        <span key={i}>{processWikiLinks(c, onOpenFile).map((part, j) =>
          typeof part === "string" ? <SensitiveText key={j}>{part}</SensitiveText> : part
        )}</span>
      ) : <SensitiveText key={i}>{c}</SensitiveText>
    ) : c
  );
  return children;
}

/** Shiki highlighter singleton */
import { createHighlighter, type Highlighter } from "shiki";

let highlighterPromise: Promise<Highlighter> | null = null;
function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-dark", "github-light"],
      langs: ["bash", "javascript", "typescript", "python", "json", "yaml", "markdown", "css", "html", "go", "rust", "sql", "diff", "dockerfile", "toml", "ini", "tsx", "jsx", "java", "c", "cpp", "shell", "ruby", "php", "swift", "kotlin"],
    });
  }
  return highlighterPromise;
}

/** Code block with copy button */
function CodeBlock({ className, children, ...props }: any) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const [html, setHtml] = useState<string>("");
  const match = /language-(\w+)/.exec(className || "");
  const text = String(children).replace(/\n$/, "");
  const isBlock = !!match || text.includes("\n");
  const isDark = document.documentElement.classList.contains("dark");

  useEffect(() => {
    if (!isBlock || !match) return;
    if (match[1] === "mermaid") return;
    let cancelled = false;
    getHighlighter().then((hl) => {
      if (cancelled) return;
      const lang = hl.getLoadedLanguages().includes(match[1] as any) ? match[1] : "text";
      const result = hl.codeToHtml(text, {
        lang,
        theme: isDark ? "github-dark" : "github-light",
      });
      setHtml(result);
    });
    return () => { cancelled = true; };
  }, [text, match?.[1], isDark, isBlock]);

  if (!isBlock) {
    if (typeof children === "string") {
      return <code {...props}><SensitiveText>{children}</SensitiveText></code>;
    }
    return <code {...props}>{children}</code>;
  }
  // Mermaid diagrams
  if (match && match[1] === "mermaid") {
    return <MermaidBlock code={text} />;
  }
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
          fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
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
      {html ? (
        <div className="shiki-wrapper" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre style={{
          margin: 0, borderRadius: "0.75rem", fontSize: "0.85rem", lineHeight: "1.7",
          border: "1px solid var(--pre-border)", padding: "1rem",
          background: "var(--pre-bg)", color: "var(--pre-text)",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace", overflowX: "auto", whiteSpace: "pre",
        }}>
          <code>{text}</code>
        </pre>
      )}
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

/** WikiLink component: renders [[xxx]] as clickable link */
function WikiLink({ target, onOpenFile }: { target: string; onOpenFile?: (path: string) => void }) {
  const [resolved, setResolved] = useState<{ found: boolean; path: string | null } | null>(null);

  useEffect(() => {
    resolveWikilink(target).then(setResolved).catch(() => setResolved({ found: false, path: null }));
  }, [target]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (resolved?.found && resolved.path && onOpenFile) {
      onOpenFile(resolved.path);
    }
  };

  if (!resolved) return <span style={{ color: "var(--text-muted)" }}>[[{target}]]</span>;

  if (resolved.found) {
    return (
      <a
        href="#"
        onClick={handleClick}
        className="wikilink"
        style={{ color: "#3b82f6", textDecoration: "underline", cursor: "pointer" }}
      >
        {target}
      </a>
    );
  }

  return (
    <span
      className="wikilink-broken"
      style={{ color: "#ef4444", textDecoration: "underline", textDecorationStyle: "dashed", cursor: "default" }}
      title="File not found"
    >
      {target}
    </span>
  );
}

/** Process text to replace [[xxx]] with WikiLink components */
function processWikiLinks(text: string, onOpenFile?: (path: string) => void): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\[\[([^\]]+)\]\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(<WikiLink key={match.index} target={match[1].trim()} onOpenFile={onOpenFile} />);
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

/** Backlinks panel */
function BacklinksPanel({ filePath, onOpenFile }: { filePath: string; onOpenFile?: (path: string) => void }) {
  const { t } = useLocale();
  const [backlinks, setBacklinks] = useState<BacklinkEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchBacklinks(filePath)
      .then(setBacklinks)
      .catch(() => setBacklinks([]))
      .finally(() => setLoading(false));
  }, [filePath]);

  return (
    <div className="border-t mt-6 pt-4" style={{ borderColor: "var(--border)" }}>
      <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3" style={{ color: "var(--text-muted)" }}>
        <Link2 className="w-4 h-4" />
        {t("backlinks.title")}
        {!loading && backlinks.length > 0 && (
          <span className="text-xs font-normal ml-1" style={{ color: "var(--text-faint)" }}>({backlinks.length})</span>
        )}
      </h3>
      {loading ? (
        <div className="text-xs" style={{ color: "var(--text-faint)" }}>Loading...</div>
      ) : backlinks.length === 0 ? (
        <div className="text-xs" style={{ color: "var(--text-faint)" }}>{t("backlinks.none")}</div>
      ) : (
        <div className="space-y-2">
          {backlinks.map((bl, i) => (
            <button
              key={`${bl.path}-${bl.line}-${i}`}
              onClick={() => onOpenFile?.(bl.path)}
              className="w-full text-left rounded-lg p-2.5 text-sm transition-colors hover:bg-white/5"
              style={{ background: "var(--bg-hover)", border: "1px solid var(--border)" }}
            >
              <div className="font-medium text-xs" style={{ color: "var(--link)" }}>{bl.path}</div>
              <div className="text-xs mt-1 truncate" style={{ color: "var(--text-secondary)" }}>
                <span style={{ color: "var(--text-faint)" }}>{t("backlinks.line")} {bl.line}:</span> {bl.context}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface FileViewerProps {
  filePath: string;
  refreshKey?: number;
  onNavigate?: (dir: string) => void;
  onOpenFile?: (path: string) => void;
}

export function FileViewer({ filePath, refreshKey, onNavigate, onOpenFile }: FileViewerProps) {
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

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains("dark")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

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
            {(frontMatter.meta || frontMatter.metadata) && (() => {
              const md = frontMatter.metadata;
              const cb = md?.clawdbot || md?.openclaw;
              const emoji = cb?.emoji || "🧩";
              const requires = cb?.requires;
              const extraMeta = frontMatter.meta ? Object.entries(frontMatter.meta).filter(([k]) => k !== "name" && k !== "description") : [];
              return (
              <div className="mb-6 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                {/* Header */}
                <div className="px-5 py-2.5" style={{ background: isDark ? "linear-gradient(135deg, #1e293b, #1a1c2b)" : "linear-gradient(135deg, #f5f0eb, #faf8f5)" }}>
                  <div className="flex items-center gap-3">
                    {frontMatter.meta?.name && (
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{emoji}</span>
                        <h2 className="text-lg font-bold" style={{ color: "var(--link)" }}>{frontMatter.meta.name}</h2>
                      </div>
                    )}
                  </div>
                  {frontMatter.meta?.description && (
                    <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{frontMatter.meta.description}</p>
                  )}
                </div>
                {/* Tags: extra fields + requires */}
                {(extraMeta.length > 0 || requires) && (
                  <div className="px-5 py-2.5 flex flex-wrap gap-2" style={{ background: "var(--bg-tertiary)", borderTop: "1px solid var(--border)" }}>
                    {extraMeta.map(([k, v]) => (
                      <span key={k} className="inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 font-medium" style={{ background: "var(--bg-active)", color: "var(--link)" }}>
                        <span style={{ color: "var(--text-faint)" }}>{k}:</span> {v}
                      </span>
                    ))}
                    {requires?.skills?.map((s: string) => (
                      <span key={s} className="inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 font-medium" style={{ background: isDark ? "rgba(139,92,246,0.15)" : "rgba(139,92,246,0.1)", color: isDark ? "#a78bfa" : "#7c3aed" }}>
                        🔗 {s}
                      </span>
                    ))}
                    {requires?.tools?.map((t: string) => (
                      <span key={t} className="inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 font-medium" style={{ background: isDark ? "rgba(34,197,94,0.15)" : "rgba(34,197,94,0.1)", color: isDark ? "#4ade80" : "#16a34a" }}>
                        🔧 {t}
                      </span>
                    ))}
                    {requires?.secrets?.map((s: string) => (
                      <span key={s} className="inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 font-medium" style={{ background: isDark ? "rgba(251,191,36,0.15)" : "rgba(251,191,36,0.1)", color: isDark ? "#fbbf24" : "#d97706" }}>
                        🔑 {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              );
            })()}
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkFrontmatter]}
              rehypePlugins={[rehypeRaw]}
              components={{
                pre({ children }) {
                  // Shiki/CodeBlock handles its own wrapper, so just pass through
                  return <>{children}</>;
                },
                code: CodeBlock,
                // Mask in plain text nodes within paragraphs
                p({ children }) {
                  return <p>{maskChildren(children, onOpenFile)}</p>;
                },
                li({ children }) {
                  return <li>{maskChildren(children, onOpenFile)}</li>;
                },
                td({ children }) {
                  return <td>{maskChildren(children, onOpenFile)}</td>;
                },
              }}
            >{content}</ReactMarkdown>
            <BacklinksPanel filePath={filePath} onOpenFile={onOpenFile} />
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
