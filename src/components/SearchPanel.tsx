import { useState, useRef, useEffect, useCallback } from "react";
import { searchFiles, semanticSearch, type SearchResult, type SemanticResult } from "../api";
import { MagnifyingGlass, FileText, TextAa, Brain, Atom } from "@phosphor-icons/react";
import { useLocale } from "../hooks/useLocale";

type SearchMode = "text" | "bm25" | "vector";

interface SearchPanelProps {
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function SearchPanel({ onSelect, onClose }: SearchPanelProps) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("text");
  const [textResults, setTextResults] = useState<SearchResult[]>([]);
  const [semanticResults, setSemanticResults] = useState<SemanticResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const doSearch = useCallback((q: string, m: SearchMode) => {
    if (q.length < 2) {
      setTextResults([]);
      setSemanticResults([]);
      return;
    }
    setLoading(true);
    if (m === "text") {
      searchFiles(q)
        .then(setTextResults)
        .catch(() => setTextResults([]))
        .finally(() => setLoading(false));
    } else {
      semanticSearch(q, m)
        .then(setSemanticResults)
        .catch(() => setSemanticResults([]))
        .finally(() => setLoading(false));
    }
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    clearTimeout(timerRef.current);
    const delay = mode === "text" ? 300 : 500;
    timerRef.current = setTimeout(() => doSearch(val, mode), delay);
  };

  const handleModeChange = (m: SearchMode) => {
    setMode(m);
    setTextResults([]);
    setSemanticResults([]);
    if (query.length >= 2) {
      setLoading(true);
      const delay = m === "text" ? 0 : 100;
      setTimeout(() => doSearch(query, m), delay);
    }
  };

  const handleSelect = (path: string) => {
    onSelect(path);
    onClose();
  };

  const totalMatches = mode === "text"
    ? textResults.reduce((s, r) => s + r.matches.length, 0)
    : semanticResults.length;

  const modeButtons: { key: SearchMode; icon: typeof TextAa; label: string }[] = [
    { key: "text", icon: TextAa, label: t("search.modeText") },
    { key: "bm25", icon: MagnifyingGlass, label: "BM25" },
    { key: "vector", icon: Brain, label: t("search.modeSemantic") },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <MagnifyingGlass className="w-5 h-5 shrink-0" style={{ color: "var(--text-faint)" }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder={t("search.placeholder")}
            className="flex-1 bg-transparent outline-none text-base"
            style={{ color: "var(--text-primary)" }}
          />
          {loading && (
            <div className="flex items-center gap-2">
              {mode !== "text" && <span className="text-xs" style={{ color: "var(--text-faint)" }}>搜索中…</span>}
              <div className="w-4 h-4 border-2 border-t-blue-400 rounded-full animate-spin" style={{ borderColor: "var(--border)" }} />
            </div>
          )}
          <kbd className="hidden sm:inline-block text-xs px-1.5 py-0.5 rounded" style={{ color: "var(--text-faint)", background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
            ESC
          </kbd>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 px-4 py-2 border-b" style={{ borderColor: "var(--border)" }}>
          {modeButtons.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => handleModeChange(key)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors"
              style={{
                background: mode === key ? "var(--accent-bg, rgba(59,130,246,0.15))" : "transparent",
                color: mode === key ? "var(--accent, #3b82f6)" : "var(--text-faint)",
                border: mode === key ? "1px solid var(--accent, #3b82f6)" : "1px solid transparent",
              }}
            >
              <Icon size={14} weight={mode === key ? "bold" : "regular"} />
              {label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {loading && query.length >= 2 && mode !== "text" && (
            <div className="px-4 py-3 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 rounded w-2/3 mb-2" style={{ background: "var(--bg-tertiary)" }} />
                  <div className="h-3 rounded w-full mb-1" style={{ background: "var(--bg-tertiary)", opacity: 0.6 }} />
                  <div className="h-3 rounded w-4/5" style={{ background: "var(--bg-tertiary)", opacity: 0.4 }} />
                </div>
              ))}
            </div>
          )}
          {query.length >= 2 && totalMatches === 0 && !loading && (
            <div className="px-4 py-8 text-center" style={{ color: "var(--text-faint)" }}>
              {t("search.noResults")} &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Text search results */}
          {mode === "text" && textResults.map((r) => (
            <button
              key={r.path}
              onClick={() => handleSelect(r.path)}
              className="w-full text-left px-4 py-3 transition-colors border-b last:border-0"
              style={{ borderColor: "var(--border-light)" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <div className="text-sm font-medium text-blue-400 mb-1">
                <FileText className="w-3.5 h-3.5 inline-block mr-1" />{r.path}
              </div>
              {r.matches.map((m, i) => (
                <div key={i} className="text-xs truncate pl-4" style={{ color: "var(--text-muted)" }}>
                  <span className="mr-2" style={{ color: "var(--text-faint)" }}>L{m.line}</span>
                  {highlightMatch(m.text, query)}
                </div>
              ))}
            </button>
          ))}

          {/* Semantic search results */}
          {mode !== "text" && semanticResults.map((r, idx) => (
            <button
              key={`${r.path}-${idx}`}
              onClick={() => handleSelect(r.path)}
              className="w-full text-left px-4 py-3 transition-colors border-b last:border-0"
              style={{ borderColor: "var(--border-light)" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-medium text-blue-400">
                  <FileText className="w-3.5 h-3.5 inline-block mr-1" />{r.path}
                </div>
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    background: r.score >= 50 ? "rgba(34,197,94,0.15)" : "rgba(234,179,8,0.15)",
                    color: r.score >= 50 ? "#22c55e" : "#eab308",
                  }}
                >
                  {r.score}% {t("search.relevance")}
                </span>
              </div>
              {r.title && (
                <div className="text-xs font-medium mb-0.5" style={{ color: "var(--text-secondary)" }}>
                  {r.title}
                </div>
              )}
              <div className="text-xs line-clamp-2 pl-4" style={{ color: "var(--text-muted)" }}>
                {r.snippet}
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        {totalMatches > 0 && (
          <div className="px-4 py-2 border-t text-xs" style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}>
            {mode === "text"
              ? `${textResults.length} ${t("search.files")} · ${totalMatches} ${t("search.matches")}`
              : `${semanticResults.length} ${t("search.results")} · ${mode === "vector" ? "🧠" : "📊"} ${mode.toUpperCase()}`
            }
          </div>
        )}
      </div>
    </div>
  );
}

function highlightMatch(text: string, query: string) {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-yellow-500/30 text-yellow-600 dark:text-yellow-200 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </span>
  );
}
