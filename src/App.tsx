import { useEffect, useState, useCallback } from "react";
import { fetchFiles, type FileNode } from "./api";
import { FileTree } from "./components/FileTree";
import { FileViewer } from "./components/FileViewer";
import { Dashboard } from "./components/Dashboard";
import { SearchPanel } from "./components/SearchPanel";
import { useWebSocket } from "./hooks/useWebSocket";
import { useTheme } from "./hooks/useTheme";
import { useSensitiveState, SensitiveProvider } from "./hooks/useSensitive";
import { BookOpen, X, Menu, Search, Sun, Moon, Eye, EyeOff, Languages } from "lucide-react";
import { useLocaleState, LocaleContext } from "./hooks/useLocale";

export default function App() {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [activeFile, setActiveFile] = useState("");
  const [view, setView] = useState<"dashboard" | "file">("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { theme, toggle: toggleTheme } = useTheme();
  const sensitive = useSensitiveState();
  const localeState = useLocaleState();
  const { t, toggleLocale, locale } = localeState;

  const loadFiles = useCallback(() => {
    fetchFiles().then(setFiles).catch(console.error);
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  // Live reload via WebSocket
  useWebSocket((data) => {
    if (data.type === "file-change") {
      loadFiles();
      // If the changed file is currently open, refresh it
      if (data.path === activeFile) {
        setRefreshKey((k) => k + 1);
      }
    }
  });

  // Ctrl+K to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const openFile = (path: string) => {
    setActiveFile(path);
    setView("file");
    setSidebarOpen(false);
  };

  const goHome = () => {
    setView("dashboard");
    setActiveFile("");
    setSidebarOpen(false);
  };

  return (
    <LocaleContext.Provider value={localeState}>
    <SensitiveProvider value={sensitive}>
    <div className={`flex h-dvh ${sensitive.hidden ? "" : "sensitive-revealed"}`} style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar fixed z-40 lg:static lg:z-auto inset-y-0 left-0 w-72 border-r flex flex-col shrink-0 transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Header */}
        <div className="sidebar-header px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <button onClick={goHome} className="text-base font-bold hover:text-blue-400 transition-colors whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
              <BookOpen className="w-4.5 h-4.5 inline-block mr-1 -mt-0.5" /> Memory Viewer
            </button>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1" style={{ color: "var(--text-muted)" }}>
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-0.5 mt-2">
            <button onClick={sensitive.toggle} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: "var(--text-muted)" }} title={sensitive.hidden ? t("sidebar.showSensitive") : t("sidebar.hideSensitive")}>
              {sensitive.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <button onClick={toggleTheme} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: "var(--text-muted)" }} title={theme === "dark" ? t("sidebar.lightMode") : t("sidebar.darkMode")}>
              {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button onClick={toggleLocale} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: "var(--text-muted)" }} title={locale === "en" ? "切换到中文" : "Switch to English"}>
              <Languages className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          className="search-trigger mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
        >
          <Search className="w-4 h-4" />
          {t("sidebar.search")}
          <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded border hidden sm:inline" style={{ background: "var(--bg-hover)", borderColor: "var(--border)" }}>
            ⌘K
          </kbd>
        </button>

        {/* File tree */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <FileTree nodes={files} activeFile={activeFile} onSelect={openFile} />
        </div>

        {/* Footer */}
        <div className="sidebar-footer px-4 py-2.5 border-t text-xs">
          {t("sidebar.footer")}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-2.5 border-b backdrop-blur shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
          <button onClick={() => setSidebarOpen(true)} style={{ color: "var(--text-muted)" }}>
            <Menu className="w-6 h-6" />
          </button>
          <span className="text-sm font-medium truncate">
            {view === "file" ? activeFile : t("dashboard.title")}
          </span>
          <button onClick={sensitive.toggle} className="ml-auto p-1" style={{ color: "var(--text-muted)" }}>
            {sensitive.hidden ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
          <button onClick={toggleTheme} className="p-1" style={{ color: "var(--text-muted)" }}>
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button onClick={() => setSearchOpen(true)} style={{ color: "var(--text-muted)" }}>
            <Search className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {view === "dashboard" ? (
            <div className="h-full overflow-auto">
              <Dashboard onOpenFile={openFile} />
            </div>
          ) : (
            <FileViewer filePath={activeFile} refreshKey={refreshKey} />
          )}
        </div>
      </main>

      {/* Search modal */}
      {searchOpen && (
        <SearchPanel onSelect={openFile} onClose={() => setSearchOpen(false)} />
      )}
    </div>
    </SensitiveProvider>
    </LocaleContext.Provider>
  );
}
