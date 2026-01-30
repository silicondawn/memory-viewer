import { useState, useRef, useEffect, useCallback } from "react";
import { searchFiles, type SearchResult } from "../api";

interface SearchPanelProps {
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function SearchPanel({ onSelect, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keyboard shortcut: Escape to close
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
        className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
          <svg className="w-5 h-5 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search all memory files…"
            className="flex-1 bg-transparent text-gray-100 placeholder-gray-500 outline-none text-base"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin" />
          )}
          <kbd className="hidden sm:inline-block text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {query.length >= 2 && results.length === 0 && !loading && (
            <div className="px-4 py-8 text-center text-gray-500">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}
          {results.map((r) => (
            <button
              key={r.path}
              onClick={() => handleSelect(r.path)}
              className="w-full text-left px-4 py-3 hover:bg-gray-800/60 transition-colors border-b border-gray-800/50 last:border-0"
            >
              <div className="text-sm font-medium text-blue-400 mb-1">
                📄 {r.path}
              </div>
              {r.matches.map((m, i) => (
                <div key={i} className="text-xs text-gray-400 truncate pl-4">
                  <span className="text-gray-600 mr-2">L{m.line}</span>
                  {highlightMatch(m.text, query)}
                </div>
              ))}
            </button>
          ))}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-800 text-xs text-gray-600">
            {results.length} files · {totalMatches} matches
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
      <mark className="bg-yellow-500/30 text-yellow-200 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </span>
  );
}
