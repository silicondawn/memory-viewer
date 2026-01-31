import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { fetchFile, saveFile } from "../api";
import { Pencil, Save, X, Check, AlertCircle } from "lucide-react";

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

interface FileViewerProps {
  filePath: string;
  refreshKey?: number;
}

export function FileViewer({ filePath, refreshKey }: FileViewerProps) {
  const [content, setContent] = useState("");
  const [editContent, setEditContent] = useState("");
  const [mtime, setMtime] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const editorRef = useRef<HTMLTextAreaElement>(null);

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
        <div className="min-w-0">
          <span className={`font-medium truncate ${hasChanges ? "text-yellow-400" : ""}`} style={hasChanges ? {} : { color: "var(--text-primary)" }}>
            {hasChanges && "● "}{filePath}
          </span>
          <span className="text-xs ml-3 hidden sm:inline" style={{ color: "var(--text-faint)" }}>
            {new Date(mtime).toLocaleString()}
          </span>
        </div>
        <div className="flex gap-2 shrink-0">
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
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
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
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkFrontmatter]}>{content}</ReactMarkdown>
          </article>
        )}
      </div>

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
