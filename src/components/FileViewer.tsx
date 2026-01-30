import { useEffect, useState, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fetchFile, saveFile } from "../api";

interface FileViewerProps {
  filePath: string;
  refreshKey?: number; // bump to force reload
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
      .catch(() => showToast("❌ Failed to load"))
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
        showToast("✅ Saved");
      }
    } catch {
      showToast("❌ Save failed");
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

  // Ctrl+S
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

  // Unsaved changes warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChanges) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="w-5 h-5 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin mr-3" />
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-gray-900/80 backdrop-blur shrink-0">
        <div className="min-w-0">
          <span className={`font-medium truncate ${hasChanges ? "text-yellow-400" : "text-white"}`}>
            {hasChanges && "● "}{filePath}
          </span>
          <span className="text-xs text-gray-500 ml-3 hidden sm:inline">
            {new Date(mtime).toLocaleString()}
          </span>
        </div>
        <div className="flex gap-2 shrink-0">
          {editing ? (
            <>
              <button onClick={handleSave} className="btn-primary text-sm">
                Save
              </button>
              <button onClick={handleCancel} className="btn-secondary text-sm">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={handleEdit} className="btn-secondary text-sm">
              ✏️ Edit
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
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </article>
        )}
      </div>

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
