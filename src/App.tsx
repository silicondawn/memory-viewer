import { useEffect, useState, useCallback } from "react";
import { fetchFiles, fetchSkills, setBaseUrl, getBaseUrl, type FileNode, type SkillInfo } from "./api";
import { FileTree } from "./components/FileTree";
import { FileViewer } from "./components/FileViewer";
import { Dashboard } from "./components/Dashboard";
import { SearchPanel } from "./components/SearchPanel";
import { Connections } from "./components/Connections";
import { Changelog } from "./components/Changelog";
import { SkillsPage } from "./components/SkillsPage";
import { Timeline } from "./components/Timeline";
import { useWebSocket } from "./hooks/useWebSocket";
import { useTheme } from "./hooks/useTheme";
import { useSensitiveState, SensitiveProvider } from "./hooks/useSensitive";
import { useConnections } from "./hooks/useConnections";
import { useAgents } from "./hooks/useAgents";
import { AgentStatusPage } from "./components/AgentStatus";
import { SettingsPage } from "./components/SettingsPage";
import { Tags } from "./components/Tags";
import { CronManager } from "./components/CronManager";
import { BookOpen, X, List, MagnifyingGlass, Sun, Moon, Eye, EyeSlash, Translate, ShareNetwork, CaretDown, CaretUp, ArrowsClockwise, Gear, Monitor, PuzzlePiece, CaretRight, Calendar, SquaresFour, Power, Clock, Tag, Robot, Timer } from "@phosphor-icons/react";
import { useSyncExternalStore } from "react";
import { pluginRegistry } from "./plugins/registry";
import { useZoom } from "./hooks/useZoom";
import { useMarkdownTheme } from "./themes";
import { useResizableSidebar } from "./hooks/useResizableSidebar";
import { useLocaleState, LocaleContext } from "./hooks/useLocale";

export default function App() {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [activeFile, setActiveFile] = useState("");
  const [view, setView] = useState<"dashboard" | "file" | "connections" | "changelog" | "agent-status" | "skills" | "timeline" | "tags" | "cron" | "settings">("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [botSelectorOpen, setBotSelectorOpen] = useState(false);
  const [agentSelectorOpen, setAgentSelectorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teslaMode, setTeslaMode] = useState(() => localStorage.getItem("memory-viewer-tesla") === "true");
  const { zoom, setZoom, ZOOM_LEVELS } = useZoom();
  const { current: currentMdTheme, setTheme: setMdTheme, themes: mdThemes } = useMarkdownTheme();
  const { width: sidebarWidth, onMouseDown: onResizeMouseDown, onTouchStart: onResizeTouchStart } = useResizableSidebar();
  const { theme, toggle: toggleTheme } = useTheme();
  const sensitive = useSensitiveState();
  const localeState = useLocaleState();
  const { t, toggleLocale, locale } = localeState;
  const connState = useConnections();
  const agentsState = useAgents();
  const pluginVersion = useSyncExternalStore(pluginRegistry.subscribe, pluginRegistry.getSnapshot);
  const allPlugins = pluginRegistry.getAll();

  // Sync baseUrl when active connection changes
  useEffect(() => {
    setBaseUrl(connState.active.url);
  }, [connState.active]);

  const loadFiles = useCallback(() => {
    fetchFiles().then(setFiles).catch(console.error);
    fetchSkills().then(setSkills).catch(console.error);
  }, []);

  // Reload files when active connection or agent changes
  useEffect(() => { 
    loadFiles(); 
  }, [loadFiles, connState.active.id, agentsState.selectedAgentId]);

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

  // Close agent selector on outside click
  useEffect(() => {
    if (!agentSelectorOpen) return;
    const handler = () => setAgentSelectorOpen(false);
    setTimeout(() => document.addEventListener("click", handler), 0);
    return () => document.removeEventListener("click", handler);
  }, [agentSelectorOpen]);

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
      if (hash === "#/skills") { setView("skills"); return; }
      if (hash === "#/timeline") { setView("timeline"); return; }
      if (hash === "#/tags") { setView("tags"); return; }
      if (hash === "#/cron") { setView("cron"); return; }
      if (hash === "#/settings") { setView("settings"); return; }
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

  const switchAgent = (agentId: string) => {
    agentsState.selectAgent(agentId);
    setAgentSelectorOpen(false);
    setView("dashboard");
    setActiveFile("");
    // Reload files for new agent
    setTimeout(() => loadFiles(), 0);
  };

  const online = connState.statuses[connState.active.id] ?? (connState.active.isLocal ? true : false);
  const todayFile = `memory/${new Date().toISOString().slice(0, 10)}.md`;

  // Show agent selector only for local connections with multiple agents
  const showAgentSelector = connState.active.isLocal && agentsState.agents.length > 1;

  return (
    <LocaleContext.Provider value={localeState}>
    <SensitiveProvider value={sensitive}>
    <div className={`flex ${sensitive.hidden ? "" : "sensitive-revealed"} ${teslaMode ? "tesla-mode" : ""}`} style={{ background: "var(--bg-primary)", color: "var(--text-primary)", transform: `scale(${zoom / 100})`, transformOrigin: "top left", width: `${10000 / zoom}%`, height: `${10000 / zoom}vh`, overflow: "hidden" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar - Redesigned */}
      <aside
        className={`sidebar fixed z-40 lg:static lg:z-auto inset-y-0 left-0 w-60 border-r flex flex-col shrink-0 transition-transform duration-200 lg:relative ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        style={{ width: window.innerWidth >= 1024 ? `${sidebarWidth}px` : undefined }}
      >
        {/* Header - Minimal */}
        <div className="sidebar-header px-3 py-2.5 border-b flex items-center justify-between">
          <button onClick={goHome} className="text-sm font-semibold hover:text-blue-400 transition-colors flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
            <BookOpen className="w-4 h-4" /> Memory Viewer
          </button>
          <div className="flex items-center gap-0.5">
            {/* Mobile close */}
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5" style={{ color: "var(--text-muted)" }}>
              <X className="w-4 h-4" />
            </button>
            {/* Settings gear - all tools inside */}
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setSettingsOpen(!settingsOpen); }} 
                className="p-1.5 rounded-md transition-colors hover:bg-white/10" 
                style={{ color: "var(--text-muted)" }} 
                title="Settings"
              >
                <Gear className="w-4 h-4" />
              </button>
              {settingsOpen && (
                <div
                  className="absolute top-full right-0 mt-2 rounded-lg shadow-xl z-50 p-3 w-56"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Quick tools */}
                  <div className="flex items-center gap-1 mb-3 pb-3 border-b" style={{ borderColor: "var(--border)" }}>
                    <button onClick={() => window.location.reload()} className="p-2 rounded-md transition-colors hover:bg-white/10 flex-1" style={{ color: "var(--text-muted)" }} title="Refresh">
                      <ArrowsClockwise className="w-4 h-4 mx-auto" />
                    </button>
                    <button onClick={sensitive.toggle} className="p-2 rounded-md transition-colors hover:bg-white/10 flex-1" style={{ color: "var(--text-muted)" }} title={sensitive.hidden ? t("sidebar.showSensitive") : t("sidebar.hideSensitive")}>
                      {sensitive.hidden ? <EyeSlash className="w-4 h-4 mx-auto" /> : <Eye className="w-4 h-4 mx-auto" />}
                    </button>
                    <button onClick={toggleTheme} className="p-2 rounded-md transition-colors hover:bg-white/10 flex-1" style={{ color: "var(--text-muted)" }} title={theme === "dark" ? t("sidebar.lightMode") : t("sidebar.darkMode")}>
                      {theme === "dark" ? <Sun className="w-4 h-4 mx-auto" /> : <Moon className="w-4 h-4 mx-auto" />}
                    </button>
                    <button onClick={toggleLocale} className="p-2 rounded-md transition-colors hover:bg-white/10 flex-1" style={{ color: "var(--text-muted)" }} title={locale === "en" ? "切换到中文" : "Switch to English"}>
                      <Translate className="w-4 h-4 mx-auto" />
                    </button>
                  </div>
                  {/* Zoom */}
                  <div className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>Zoom</div>
                  <div className="flex flex-wrap gap-1 mb-3">
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
                  {/* Preview Theme */}
                  <div className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>Preview Theme</div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {mdThemes.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => setMdTheme(theme.id)}
                        className="px-2 py-1 rounded text-xs transition-colors"
                        style={{
                          background: currentMdTheme.id === theme.id ? "var(--bg-active)" : "var(--bg-hover)",
                          color: currentMdTheme.id === theme.id ? "var(--link)" : "var(--text-secondary)",
                          border: currentMdTheme.id === theme.id ? "1px solid var(--link)" : "1px solid var(--border)",
                          fontWeight: currentMdTheme.id === theme.id ? 600 : 400,
                        }}
                      >
                        {theme.name}
                      </button>
                    ))}
                  </div>
                  {/* Tesla mode */}
                  <button
                    onClick={() => { const v = !teslaMode; setTeslaMode(v); localStorage.setItem("memory-viewer-tesla", String(v)); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors"
                    style={{ background: teslaMode ? "var(--bg-active)" : "var(--bg-hover)", color: teslaMode ? "var(--link)" : "var(--text-secondary)" }}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    Tesla Mode
                    {teslaMode && <span className="ml-auto text-[10px]">✓</span>}
                  </button>
                  {/* Plugins */}
                  {allPlugins.length > 0 && (
                    <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                      <div className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-2" style={{ color: "var(--text-muted)" }}>
                        Plugins
                      </div>
                      {allPlugins.map((p) => {
                        const enabled = pluginRegistry.isEnabled(p.id);
                        return (
                          <button
                            key={`${p.id}-${pluginVersion}`}
                            onClick={() => enabled ? pluginRegistry.disable(p.id) : pluginRegistry.enable(p.id)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors"
                            style={{ background: enabled ? "var(--bg-active)" : "var(--bg-hover)", color: enabled ? "var(--link)" : "var(--text-secondary)" }}
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span className="flex-1 text-left">{p.name}</span>
                            <span className="opacity-50 text-[10px]">{p.version}</span>
                            {enabled && <span className="text-[10px]">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {/* Changelog */}
                  <button
                    onClick={() => { setSettingsOpen(false); setView("changelog"); setSidebarOpen(false); window.history.pushState(null, "", "#/changelog"); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors mt-1"
                    style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Changelog
                    <span className="ml-auto opacity-50">v1.2.0</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search - Compact */}
        <button
          onClick={() => setSearchOpen(true)}
          className="search-trigger mx-2 mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors"
        >
          <MagnifyingGlass className="w-3.5 h-3.5" />
          <span className="flex-1 text-left">{t("sidebar.search")}</span>
          <kbd className="text-[10px] px-1 py-0.5 rounded border opacity-60" style={{ background: "var(--bg-hover)", borderColor: "var(--border)" }}>
            ⌘K
          </kbd>
        </button>

        {/* Agent Selector */}
        {showAgentSelector && (
          <div className="mx-2 mt-2 relative">
            <button
              onClick={(e) => { e.stopPropagation(); setAgentSelectorOpen(!agentSelectorOpen); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors hover:bg-white/5"
              style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
            >
              <span className="text-base">{agentsState.selectedAgent?.emoji || "🤖"}</span>
              <span className="truncate flex-1 text-left text-xs font-medium">{agentsState.selectedAgent?.name || "Select Agent"}</span>
              {agentSelectorOpen ? <CaretUp className="w-3 h-3 shrink-0" /> : <CaretDown className="w-3 h-3 shrink-0" />}
            </button>

            {agentSelectorOpen && (
              <div
                className="absolute left-0 right-0 top-full mt-1 rounded-lg shadow-xl z-50 py-1 max-h-80 overflow-y-auto"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
                onClick={(e) => e.stopPropagation()}
              >
                {agentsState.agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => switchAgent(agent.id)}
                    className="w-full flex flex-col px-3 py-2 text-sm transition-colors hover:bg-white/5"
                    style={{ color: agent.id === agentsState.selectedAgentId ? "#3b82f6" : "var(--text-secondary)" }}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-base">{agent.emoji}</span>
                      <span className="truncate flex-1 text-left font-medium">{agent.name}</span>
                      {agent.id === agentsState.selectedAgentId && <span className="text-xs">✓</span>}
                    </div>
                    {agent.skills && agent.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 ml-7">
                        {agent.skills.map((skill) => (
                          <span
                            key={skill}
                            className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick Access */}
        <div className="mx-2 mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider px-1 mb-1" style={{ color: "var(--text-muted)" }}>
            {t("sidebar.quickAccess") || "Quick Access"}
          </div>
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => openFile(todayFile)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-white/5"
              style={{
                color: view === "file" && activeFile === todayFile ? "var(--link)" : "var(--text-secondary)",
                background: view === "file" && activeFile === todayFile ? "var(--bg-active)" : undefined,
              }}
            >
              <Calendar className="w-4 h-4 text-green-400" />
              {t("sidebar.today") || "Today"}
            </button>
            <button
              onClick={() => { setView("timeline"); setSidebarOpen(false); window.history.pushState(null, "", "#/timeline"); }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-white/5"
              style={{
                color: view === "timeline" ? "var(--link)" : "var(--text-secondary)",
                background: view === "timeline" ? "var(--bg-active)" : undefined,
              }}
            >
              <Clock className="w-4 h-4 text-amber-400" />
              {t("sidebar.timeline") || "Timeline"}
            </button>
            <button
              onClick={() => { setView("tags"); setSidebarOpen(false); window.history.pushState(null, "", "#/tags"); }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-white/5"
              style={{
                color: view === "tags" ? "var(--link)" : "var(--text-secondary)",
                background: view === "tags" ? "var(--bg-active)" : undefined,
              }}
            >
              <Tag className="w-4 h-4 text-pink-400" />
              {t("sidebar.tags") || "Tags"}
            </button>
            <button
              onClick={() => { setView("cron"); setSidebarOpen(false); window.history.pushState(null, "", "#/cron"); }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-white/5"
              style={{
                color: view === "cron" ? "var(--link)" : "var(--text-secondary)",
                background: view === "cron" ? "var(--bg-active)" : undefined,
              }}
            >
              <Timer className="w-4 h-4 text-indigo-400" />
              {t("sidebar.cron")}
            </button>
            <button
              onClick={goHome}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-white/5"
              style={{
                color: view === "dashboard" ? "var(--link)" : "var(--text-secondary)",
                background: view === "dashboard" ? "var(--bg-active)" : undefined,
              }}
            >
              <SquaresFour className="w-4 h-4 text-blue-400" />
              {t("dashboard.title")}
            </button>
            {skills.length > 0 && (
              <button
                onClick={() => { setView("skills"); setSidebarOpen(false); window.history.pushState(null, "", "#/skills"); }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-white/5"
                style={{
                  color: view === "skills" ? "var(--link)" : "var(--text-secondary)",
                  background: view === "skills" ? "var(--bg-active)" : undefined,
                }}
              >
                <PuzzlePiece className="w-4 h-4 text-purple-400" />
                {t("sidebar.skills")}
                <span className="ml-auto text-[10px] opacity-50">{skills.length}</span>
              </button>
            )}
            <button
              onClick={() => { setView("settings"); setSidebarOpen(false); window.history.pushState(null, "", "#/settings"); }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-white/5"
              style={{
                color: view === "settings" ? "var(--link)" : "var(--text-secondary)",
                background: view === "settings" ? "var(--bg-active)" : undefined,
              }}
            >
              <Gear className="w-4 h-4 text-gray-400" />
              {t("settings.title")}
            </button>
          </div>
        </div>

        {/* File Browser - Main content area */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <FileTree nodes={files} activeFile={activeFile} onSelect={openFile} />
        </div>

        {/* Agent Selector removed from bottom - moved to top */}

        {/* Bot Selector - Bottom */}
        <div className="border-t px-2 py-2 relative" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={(e) => { e.stopPropagation(); setBotSelectorOpen(!botSelectorOpen); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-white/5"
            style={{ color: "var(--text-secondary)" }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: online ? "#22c55e" : "#ef4444" }}
            />
            <span className="truncate flex-1 text-left text-xs">{connState.active.name}</span>
            {botSelectorOpen ? <CaretDown className="w-3 h-3 shrink-0" /> : <CaretUp className="w-3 h-3 shrink-0" />}
          </button>

          {/* Dropdown - opens upward */}
          {botSelectorOpen && (
            <div
              className="absolute left-2 right-2 bottom-full mb-1 rounded-lg shadow-xl z-50 py-1 max-h-60 overflow-y-auto"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {connState.connections.map((conn) => {
                const s = connState.statuses[conn.id] ?? (conn.isLocal ? true : false);
                return (
                  <button
                    key={conn.id}
                    onClick={() => switchBot(conn.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-white/5"
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
                onClick={() => { setBotSelectorOpen(false); setView("connections"); setSidebarOpen(false); window.history.pushState(null, "", "#/connections"); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-white/5"
                style={{ color: "var(--text-muted)" }}
              >
                <ShareNetwork className="w-3.5 h-3.5" />
                {t("connections.manage")}
              </button>
            </div>
          )}
        </div>

        {/* Resize handle - wider touch target on tablet */}
        <div
          className="hidden lg:block absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-blue-500/30 active:bg-blue-500/50 transition-colors touch-none"
          style={{ zIndex: 50 }}
          onMouseDown={onResizeMouseDown}
          onTouchStart={onResizeTouchStart}
        />
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-2.5 border-b backdrop-blur shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
          <button onClick={() => setSidebarOpen(true)} style={{ color: "var(--text-muted)" }}>
            <List className="w-6 h-6" />
          </button>
          <span className="text-sm font-medium truncate">
            {view === "file" ? activeFile : view === "changelog" ? t("changelog.title") : view === "connections" ? t("connections.title") : view === "agent-status" ? t("sidebar.agentConfig") : view === "timeline" ? t("timeline.title") : view === "tags" ? t("tags.title") : view === "cron" ? t("cron.title") : view === "settings" ? t("settings.title") : t("dashboard.title")}
          </span>
          <button onClick={() => window.location.reload()} className="ml-auto p-1" style={{ color: "var(--text-muted)" }} title="Refresh">
            <ArrowsClockwise className="w-5 h-5" />
          </button>
          <button onClick={sensitive.toggle} className="p-1" style={{ color: "var(--text-muted)" }}>
            {sensitive.hidden ? <EyeSlash className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
          <button onClick={toggleTheme} className="p-1" style={{ color: "var(--text-muted)" }}>
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button onClick={() => setSearchOpen(true)} style={{ color: "var(--text-muted)" }}>
            <MagnifyingGlass className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {view === "changelog" ? (
            <Changelog onBack={goHome} />
          ) : view === "agent-status" ? (
            <AgentStatusPage />
          ) : view === "skills" ? (
            <SkillsPage skills={skills} onOpenFile={openFile} />
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
          ) : view === "timeline" ? (
            <div className="h-full overflow-auto">
              <Timeline onOpenFile={openFile} />
            </div>
          ) : view === "tags" ? (
            <div className="h-full overflow-auto">
              <Tags onOpenFile={openFile} />
            </div>
          ) : view === "cron" ? (
            <CronManager />
          ) : view === "settings" ? (
            <SettingsPage onBack={goHome} />
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
