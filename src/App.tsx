import { useEffect, useState, useCallback } from "react";
import { fetchFiles, fetchSkills, setBaseUrl, getBaseUrl, type FileNode, type SkillInfo } from "./api";
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
import { AgentStatusPage } from "./components/AgentStatus";
import { BookOpen, X, Menu, Search, Sun, Moon, Eye, EyeOff, Languages, Network, ChevronDown, RefreshCw, Settings, Monitor, Puzzle, ChevronRight, Activity } from "lucide-react";
import { useZoom } from "./hooks/useZoom";
import { useResizableSidebar } from "./hooks/useResizableSidebar";
import { useLocaleState, LocaleContext } from "./hooks/useLocale";

export default function App() {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [skillsOpen, setSkillsOpen] = useState(true);
  const [activeFile, setActiveFile] = useState("");
  const [view, setView] = useState<"dashboard" | "file" | "connections" | "changelog" | "agent-status">("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [botSelectorOpen, setBotSelectorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teslaMode, setTeslaMode] = useState(() => localStorage.getItem("memory-viewer-tesla") === "true");
  const { zoom, setZoom, ZOOM_LEVELS } = useZoom();
  const { width: sidebarWidth, onMouseDown: onResizeMouseDown } = useResizableSidebar();
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
    fetchSkills().then(setSkills).catch(console.error);
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

  // Close settings on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    const handler = () => setSettingsOpen(false);
    setTimeout(() => document.addEventListener("click", handler), 0);
    return () => document.removeEventListener("click", handler);
  }, [settingsOpen]);

  // Sync hash → state on load and popstate
  useEffect(() => {
    const readHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith("#/file/")) {
        const path = decodeURIComponent(hash.slice(7));
        if (path) {
          setActiveFile(path);
          setView("file");
          return;
        }
      }
      if (hash === "#/agent-status") { setView("agent-status"); return; }
      if (hash === "#/connections") { setView("connections"); return; }
      if (hash === "#/changelog") { setView("changelog"); return; }
    };
    readHash();
    window.addEventListener("popstate", readHash);
    return () => window.removeEventListener("popstate", readHash);
  }, []);

  const openFile = (path: string) => {
    setActiveFile(path);
    setView("file");
    setSidebarOpen(false);
    window.history.pushState(null, "", `#/file/${encodeURIComponent(path)}`);
  };

  const goHome = () => {
    setView("dashboard");
    setActiveFile("");
    setSidebarOpen(false);
    window.history.pushState(null, "", window.location.pathname);
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
    <div className={`flex ${sensitive.hidden ? "" : "sensitive-revealed"} ${teslaMode ? "tesla-mode" : ""}`} style={{ background: "var(--bg-primary)", color: "var(--text-primary)", transform: `scale(${zoom / 100})`, transformOrigin: "top left", width: `${10000 / zoom}%`, height: `${10000 / zoom}vh`, overflow: "hidden" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar fixed z-40 lg:static lg:z-auto inset-y-0 left-0 w-80 border-r flex flex-col shrink-0 transition-transform duration-200 lg:relative ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        style={{ width: window.innerWidth >= 1024 ? `${sidebarWidth}px` : undefined }}
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
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setSettingsOpen(!settingsOpen); }} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: "var(--text-muted)" }} title="Settings">
                <Settings className="w-3.5 h-3.5" />
              </button>
              {settingsOpen && (
                <div
                  className="absolute top-full left-0 mt-2 rounded-lg shadow-lg z-50 p-3 w-52"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>Zoom Level</div>
                  <div className="flex flex-wrap gap-1">
                    {ZOOM_LEVELS.map((level) => (
                      <button
                        key={level}
                        onClick={() => setZoom(level)}
                        className="px-2 py-1 rounded text-xs transition-colors"
                        style={{
                          background: zoom === level ? "var(--bg-active)" : "var(--bg-hover)",
                          color: zoom === level ? "var(--link)" : "var(--text-secondary)",
                          border: zoom === level ? "1px solid var(--link)" : "1px solid var(--border)",
                          fontWeight: zoom === level ? 600 : 400,
                        }}
                      >
                        {level}%
                      </button>
                    ))}
                  </div>
                  <div className="border-t mt-3 pt-3" style={{ borderColor: "var(--border)" }}>
                    <button
                      onClick={() => { const v = !teslaMode; setTeslaMode(v); localStorage.setItem("memory-viewer-tesla", String(v)); }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors"
                      style={{ background: teslaMode ? "var(--bg-active)" : "var(--bg-hover)", color: teslaMode ? "var(--link)" : "var(--text-secondary)" }}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      Tesla Mode
                      {teslaMode && <span className="ml-auto text-[10px]">✓</span>}
                    </button>
                  </div>
                </div>
              )}
            </div>
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
                onClick={() => { setBotSelectorOpen(false); setView("connections"); window.history.pushState(null, "", "#/connections"); }}
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

        {/* Navigation */}
        <nav className="mx-3 mt-2 flex flex-col gap-0.5">
          <button
            onClick={() => { goHome(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
            style={{
              color: view === "dashboard" ? "var(--link)" : "var(--text-secondary)",
              background: view === "dashboard" ? "var(--bg-active)" : undefined,
            }}
          >
            <BookOpen className="w-4 h-4" />
            {t("dashboard.title")}
          </button>
          <button
            onClick={() => { setView("agent-status"); setSidebarOpen(false); window.history.pushState(null, "", "#/agent-status"); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
            style={{
              color: view === "agent-status" ? "var(--link)" : "var(--text-secondary)",
              background: view === "agent-status" ? "var(--bg-active)" : undefined,
            }}
          >
            <Activity className="w-4 h-4" />
            {t("sidebar.agentConfig")}
          </button>
          <button
            onClick={() => { setView("connections"); setSidebarOpen(false); window.history.pushState(null, "", "#/connections"); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
            style={{
              color: view === "connections" ? "var(--link)" : "var(--text-secondary)",
              background: view === "connections" ? "var(--bg-active)" : undefined,
            }}
          >
            <Network className="w-4 h-4" />
            {t("connections.title")}
          </button>
        </nav>

        {/* Skills + File tree */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          {skills.length > 0 && (
            <div className="mb-2">
              <button
                onClick={() => setSkillsOpen(!skillsOpen)}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold uppercase tracking-wide w-full hover:opacity-80 transition-opacity"
                style={{ color: "var(--text-muted)" }}
              >
                <ChevronRight className={`w-3 h-3 transition-transform ${skillsOpen ? "rotate-90" : ""}`} />
                <Puzzle className="w-3.5 h-3.5" />
                {t("sidebar.skills")}
                <span className="ml-auto text-[10px] font-normal">{skills.length}</span>
              </button>
              {skillsOpen && (
                <div className="mt-1">
                  {skills.map((skill) => (
                    <button
                      key={skill.id}
                      onClick={() => openFile(skill.path)}
                      className="w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors truncate hover:bg-white/5"
                      style={{
                        color: activeFile === skill.path ? "var(--link)" : "var(--text-secondary)",
                        background: activeFile === skill.path ? "var(--bg-active)" : undefined,
                      }}
                      title={skill.description || skill.name}
                    >
                      {skill.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <FileTree nodes={files} activeFile={activeFile} onSelect={openFile} />
        </div>

        {/* Footer */}
        <div className="sidebar-footer px-4 py-2.5 border-t text-xs flex items-center justify-between">
          <span>{t("sidebar.footer")}</span>
          <button
            onClick={() => { setView("changelog"); setSidebarOpen(false); window.history.pushState(null, "", "#/changelog"); }}
            className="hover:text-blue-400 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            v1.1.0
          </button>
        </div>

        {/* Resize handle */}
        <div
          className="hidden lg:block absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500/30 transition-colors"
          style={{ zIndex: 50 }}
          onMouseDown={onResizeMouseDown}
        />
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-2.5 border-b backdrop-blur shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
          <button onClick={() => setSidebarOpen(true)} style={{ color: "var(--text-muted)" }}>
            <Menu className="w-6 h-6" />
          </button>
          <span className="text-sm font-medium truncate">
            {view === "file" ? activeFile : view === "changelog" ? t("changelog.title") : view === "connections" ? t("connections.title") : view === "agent-status" ? t("sidebar.agentConfig") : t("dashboard.title")}
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
          ) : view === "agent-status" ? (
            <AgentStatusPage />
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
            <FileViewer filePath={activeFile} refreshKey={refreshKey} onOpenFile={openFile} />
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
