import { useEffect, useState, useCallback } from "react";
import { fetchFiles, setBaseUrl, getBaseUrl, type FileNode } from "./api";
import { FileTree } from "./components/FileTree";
import { FileViewer } from "./components/FileViewer";
import { Dashboard } from "./components/Dashboard";
import { SearchPanel } from "./components/SearchPanel";
import { Connections } from "./components/Connections";
import { Changelog } from "./components/Changelog";
import { useWebSocket } from "./hooks/useWebSocket";
import { useTheme } from "./hooks/useTheme";
import { useSensitiveState, SensitiveProvider } from "./hooks/useSensitive";
import { useConnections } from "./hooks/useConnections";
import { BookOpen, X, Menu, Search, Sun, Moon, Eye, EyeOff, Languages, Network, ChevronDown, RefreshCw } from "lucide-react";
import { useLocaleState, LocaleContext } from "./hooks/useLocale";

export default function App() {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [activeFile, setActiveFile] = useState("");
  const [view, setView] = useState<"dashboard" | "file" | "connections" | "changelog">("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [botSelectorOpen, setBotSelectorOpen] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();
  const sensitive = useSensitiveState();
  const localeState = useLocaleState();
  const { t, toggleLocale, locale } = localeState;
  const connState = useConnections();

  // Sync baseUrl when active connection changes
  useEffect(() => {
    setBaseUrl(connState.active.url);
  }, [connState.active]);

  const loadFiles = useCallback(() => {
    fetchFiles().then(setFiles).catch(console.error);
  }, []);

  // Reload files when active connection changes
  useEffect(() => { loadFiles(); }, [loadFiles, connState.active.id]);

  // Live reload via WebSocket
  useWebSocket((data) => {
    if (data.type === "file-change") {
      loadFiles();
      if (data.path === activeFile) {
        setRefreshKey((k) => k + 1);
      }
    }
  }, connState.active.url);

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

  // Close bot selector on outside click
  useEffect(() => {
    if (!botSelectorOpen) return;
    const handler = () => setBotSelectorOpen(false);
    setTimeout(() => document.addEventListener("click", handler), 0);
    return () => document.removeEventListener("click", handler);
  }, [botSelectorOpen]);

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

  const switchBot = (id: string) => {
    connState.switchTo(id);
    setBotSelectorOpen(false);
    setView("dashboard");
    setActiveFile("");
  };

  const online = connState.statuses[connState.active.id] ?? (connState.active.isLocal ? true : false);

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
        className={`sidebar fixed z-40 lg:static lg:z-auto inset-y-0 left-0 w-80 lg:w-96 border-r flex flex-col shrink-0 transition-transform duration-200 ${
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
            <button onClick={() => window.location.reload()} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: "var(--text-muted)" }} title="Refresh">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
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

        {/* Bot Selector */}
        <div className="px-3 pt-3 relative">
          <button
            onClick={(e) => { e.stopPropagation(); setBotSelectorOpen(!botSelectorOpen); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ background: "var(--bg-hover)", border: "1px solid var(--border)" }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: online ? "#22c55e" : "#ef4444" }}
            />
            <span className="truncate flex-1 text-left font-medium" style={{ color: "var(--text-primary)" }}>
              {connState.active.name}
            </span>
            <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
          </button>

          {/* Dropdown */}
          {botSelectorOpen && (
            <div
              className="absolute left-3 right-3 top-full mt-1 rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {connState.connections.map((conn) => {
                const s = connState.statuses[conn.id] ?? (conn.isLocal ? true : false);
                return (
                  <button
                    key={conn.id}
                    onClick={() => switchBot(conn.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-white/5"
                    style={{ color: conn.id === connState.active.id ? "#3b82f6" : "var(--text-secondary)" }}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s ? "#22c55e" : "#ef4444" }} />
                    <span className="truncate flex-1 text-left">{conn.name}</span>
                    {conn.id === connState.active.id && <span className="text-xs">✓</span>}
                  </button>
                );
              })}
              <div className="border-t my-1" style={{ borderColor: "var(--border)" }} />
              <button
                onClick={() => { setBotSelectorOpen(false); setView("connections"); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-white/5"
                style={{ color: "var(--text-muted)" }}
              >
                <Network className="w-3.5 h-3.5" />
                {t("connections.manage")}
              </button>
            </div>
          )}
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
        <div className="sidebar-footer px-4 py-2.5 border-t text-xs flex items-center justify-between">
          <span>{t("sidebar.footer")}</span>
          <button
            onClick={() => { setView("changelog"); setSidebarOpen(false); }}
            className="hover:text-blue-400 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            v1.1.0
          </button>
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
            {view === "file" ? activeFile : view === "changelog" ? t("changelog.title") : view === "connections" ? t("connections.title") : t("dashboard.title")}
          </span>
          <button onClick={() => window.location.reload()} className="ml-auto p-1" style={{ color: "var(--text-muted)" }} title="Refresh">
            <RefreshCw className="w-5 h-5" />
          </button>
          <button onClick={sensitive.toggle} className="p-1" style={{ color: "var(--text-muted)" }}>
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
          {view === "changelog" ? (
            <Changelog onBack={goHome} />
          ) : view === "connections" ? (
            <div className="h-full overflow-auto">
              <Connections
                connections={connState.connections}
                statuses={connState.statuses}
                activeId={connState.active.id}
                onAdd={connState.addConnection}
                onUpdate={connState.updateConnection}
                onRemove={connState.removeConnection}
                onSwitch={switchBot}
                onRefresh={connState.checkStatuses}
              />
            </div>
          ) : view === "dashboard" ? (
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
