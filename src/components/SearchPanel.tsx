import { useState, useRef, useEffect, useCallback } from "react";
import { searchFiles, type SearchResult } from "../api";
import { Search, FileText } from "lucide-react";
import { useLocale } from "../hooks/useLocale";

interface SearchPanelProps {
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function SearchPanel({ onSelect, onClose }: SearchPanelProps) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
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

  const doSearch = useCallback((q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    searchFiles(q)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSelect = (path: string) => {
    onSelect(path);
    onClose();
  };

  const totalMatches = results.reduce((s, r) => s + r.matches.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <Search className="w-5 h-5 shrink-0" style={{ color: "var(--text-faint)" }} />
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
            <div className="w-4 h-4 border-2 border-t-blue-400 rounded-full animate-spin" style={{ borderColor: "var(--border)" }} />
          )}
          <kbd className="hidden sm:inline-block text-xs px-1.5 py-0.5 rounded" style={{ color: "var(--text-faint)", background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {query.length >= 2 && results.length === 0 && !loading && (
            <div className="px-4 py-8 text-center" style={{ color: "var(--text-faint)" }}>
              {t("search.noResults")} &ldquo;{query}&rdquo;
            </div>
          )}
          {results.map((r) => (
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
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t text-xs" style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}>
            {results.length} {t("search.files")} · {totalMatches} {t("search.matches")}
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
