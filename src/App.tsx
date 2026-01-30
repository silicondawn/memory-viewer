import { useEffect, useState, useCallback } from "react";
import { fetchFiles, type FileNode } from "./api";
import { FileTree } from "./components/FileTree";
import { FileViewer } from "./components/FileViewer";
import { Dashboard } from "./components/Dashboard";
import { SearchPanel } from "./components/SearchPanel";
import { useWebSocket } from "./hooks/useWebSocket";

export default function App() {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [activeFile, setActiveFile] = useState("");
  const [view, setView] = useState<"dashboard" | "file">("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
    <div className="flex h-dvh bg-gray-950 text-gray-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed z-40 lg:static lg:z-auto inset-y-0 left-0 w-72 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-800">
          <button onClick={goHome} className="text-lg font-bold text-white hover:text-blue-400 transition-colors">
            📝 Memory Viewer
          </button>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white p-1">
            ✕
          </button>
        </div>

        {/* Search trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search…
          <kbd className="ml-auto text-[10px] bg-gray-700/50 px-1.5 py-0.5 rounded border border-gray-700 hidden sm:inline">
            ⌘K
          </kbd>
        </button>

        {/* File tree */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <FileTree nodes={files} activeFile={activeFile} onSelect={openFile} />
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-gray-800 text-xs text-gray-600">
          Silicon Dawn · Memory Viewer
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-2.5 border-b border-gray-800 bg-gray-900/80 backdrop-blur shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-medium truncate">
            {view === "file" ? activeFile : "Dashboard"}
          </span>
          <button onClick={() => setSearchOpen(true)} className="ml-auto text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
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
  );
}
