import { useState, useMemo, useEffect, useCallback } from "react";
import type { FileNode } from "../api";
import { ChevronDown, ChevronRight, Folder, FileText, Brain, Dna, Bot, User, Wrench, ListTodo, HeartPulse, IdCard, Settings, CalendarDays, Clock } from "lucide-react";
import { useLocale } from "../hooks/useLocale";

/** Well-known bot config files shown in the top section */
const BOT_FILES = new Set([
  "AGENTS.md", "SOUL.md", "MEMORY.md", "USER.md", "TOOLS.md",
  "TODO.md", "HEARTBEAT.md", "IDENTITY.md", "BOOTSTRAP.md",
]);

function isBotFile(name: string): boolean {
  return BOT_FILES.has(name);
}

/** Check if a path is a daily note (memory/YYYY-MM-DD*.md) */
function isDailyNote(path: string): boolean {
  return /^memory\/\d{4}-\d{2}-\d{2}.*\.md$/.test(path);
}

/** Get display label for daily note */
function getDailyNoteLabel(path: string): { label: string; isToday: boolean; isYesterday: boolean } {
  const match = path.match(/memory\/(\d{4}-\d{2}-\d{2})/);
  if (!match) return { label: path, isToday: false, isYesterday: false };
  
  const dateStr = match[1];
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  
  if (dateStr === today) return { label: "Today", isToday: true, isYesterday: false };
  if (dateStr === yesterday) return { label: "Yesterday", isYesterday: true, isToday: false };
  
  // Show date in a readable format for older notes
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return { label: date.toLocaleDateString("en-US", options), isToday: false, isYesterday: false };
}

/** Local storage key for collapsed state */
const COLLAPSED_KEY = "memory-viewer-collapsed";

function loadCollapsedState(): Set<string> {
  try {
    const stored = localStorage.getItem(COLLAPSED_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveCollapsedState(collapsed: Set<string>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
  } catch {
    // Ignore storage errors
  }
}

interface FileTreeProps {
  nodes: FileNode[];
  activeFile: string;
  onSelect: (path: string) => void;
}

export function FileTree({ nodes, activeFile, onSelect }: FileTreeProps) {
  const { t } = useLocale();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => loadCollapsedState());
  
  // Persist collapsed state
  useEffect(() => {
    saveCollapsedState(collapsed);
  }, [collapsed]);

  const toggleCollapsed = useCallback((path: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const { botFiles, dailyNotes, otherNodes } = useMemo(() => {
    const bot: FileNode[] = [];
    const daily: FileNode[] = [];
    const other: FileNode[] = [];
    
    function processNodes(nodeList: FileNode[]) {
      for (const node of nodeList) {
        if (node.type === "file") {
          if (isBotFile(node.name)) {
            bot.push(node);
          } else if (isDailyNote(node.path)) {
            daily.push(node);
          } else {
            other.push(node);
          }
        } else if (node.type === "dir") {
          if (node.name === "memory") {
            // Process memory dir children but don't add the dir itself
            if (node.children) {
              for (const child of node.children) {
                if (child.type === "file" && isDailyNote(child.path)) {
                  daily.push(child);
                } else if (child.type === "file") {
                  other.push(child);
                } else {
                  other.push(child);
                }
              }
            }
          } else {
            other.push(node);
          }
        }
      }
    }
    
    processNodes(nodes);
    
    // Sort bot files in a logical order
    const order = [...BOT_FILES];
    bot.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
    
    // Sort daily notes by date descending (newest first)
    daily.sort((a, b) => b.path.localeCompare(a.path));
    
    return { botFiles: bot, dailyNotes: daily, otherNodes: other };
  }, [nodes]);

  const isDailyNotesCollapsed = collapsed.has("__daily_notes__");

  return (
    <nav className="text-sm" aria-label="File tree">
      {/* Bot Config Files */}
      {botFiles.length > 0 && (
        <div className="mb-3">
          <div className="sidebar-section-title px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider">
            {t("sidebar.coreFiles") || "Core Files"}
          </div>
          {botFiles.map((node) => (
            <TreeNode key={node.path} node={node} activeFile={activeFile} onSelect={onSelect} depth={0} collapsed={collapsed} onToggle={toggleCollapsed} />
          ))}
        </div>
      )}
      
      {/* Daily Notes */}
      {dailyNotes.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => toggleCollapsed("__daily_notes__")}
            className="sidebar-section-title px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 w-full hover:opacity-80"
          >
            {isDailyNotesCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <CalendarDays className="w-3 h-3" />
            {t("sidebar.dailyNotes") || "Daily Notes"}
            <span className="ml-auto text-[10px] font-normal opacity-60">{dailyNotes.length}</span>
          </button>
          {!isDailyNotesCollapsed && dailyNotes.map((node) => {
            const { label, isToday, isYesterday } = getDailyNoteLabel(node.path);
            const isActive = activeFile === node.path;
            return (
              <button
                key={node.path}
                onClick={() => onSelect(node.path)}
                className={`flex items-center gap-1.5 w-full py-1.5 rounded-md transition-colors ${
                  isActive ? "sidebar-item-active font-medium" : "sidebar-item"
                }`}
                style={{ paddingLeft: "20px" }}
              >
                <span className="opacity-70 shrink-0">
                  {isToday ? <CalendarDays className="w-3.5 h-3.5 text-green-400" /> :
                   isYesterday ? <Clock className="w-3.5 h-3.5 text-blue-400" /> :
                   <FileText className="w-3.5 h-3.5 text-gray-500" />}
                </span>
                <span className="truncate">{label}</span>
                {/* Show filename suffix if not just date */}
                {node.name !== `${node.path.match(/\d{4}-\d{2}-\d{2}/)?.[0]}.md` && (
                  <span className="text-[10px] opacity-50 truncate">{node.name.replace(/^\d{4}-\d{2}-\d{2}-?/, "").replace(".md", "")}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
      
      {/* Other Files */}
      {otherNodes.length > 0 && (
        <div>
          <div className="sidebar-section-title px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider">
            {t("sidebar.files")}
          </div>
          {otherNodes.map((node) => (
            <TreeNode key={node.path} node={node} activeFile={activeFile} onSelect={onSelect} depth={0} collapsed={collapsed} onToggle={toggleCollapsed} />
          ))}
        </div>
      )}
    </nav>
  );
}

function TreeNode({ node, activeFile, onSelect, depth, collapsed, onToggle }: {
  node: FileNode;
  activeFile: string;
  onSelect: (path: string) => void;
  depth: number;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
}) {
  const indent = depth * 12 + 8;
  const isCollapsed = collapsed.has(node.path);
  // Default: depth 0 directories are expanded, deeper ones collapsed (unless explicitly toggled)
  const isOpen = collapsed.has(node.path) ? false : (depth === 0 || !collapsed.has(`__default_collapsed_${node.path}`));

  if (node.type === "dir") {
    return (
      <div>
        <button
          onClick={() => onToggle(node.path)}
          className="sidebar-item flex items-center gap-1.5 w-full py-1.5 rounded-md"
          style={{ paddingLeft: `${indent}px` }}
        >
          {!isCollapsed ? <ChevronDown className="w-3 h-3 opacity-60 shrink-0" /> : <ChevronRight className="w-3 h-3 opacity-60 shrink-0" />}
          <Folder className={`w-3.5 h-3.5 shrink-0 ${!isCollapsed ? "text-amber-400" : "text-amber-400/60"}`} />
          <span className="truncate">{node.name}</span>
          {node.children && (
            <span className="text-[10px] ml-auto mr-2" style={{ color: "var(--text-faint)" }}>{node.children.length}</span>
          )}
        </button>
        {!isCollapsed && node.children?.map((child) => (
          <TreeNode key={child.path} node={child} activeFile={activeFile} onSelect={onSelect} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} />
        ))}
      </div>
    );
  }

  const isActive = activeFile === node.path;
  return (
    <button
      onClick={() => onSelect(node.path)}
      className={`flex items-center gap-1.5 w-full py-1.5 rounded-md transition-colors ${
        isActive ? "sidebar-item-active font-medium" : "sidebar-item"
      }`}
      style={{ paddingLeft: `${indent}px` }}
    >
      <span className="opacity-70 shrink-0">
        {node.name === "MEMORY.md" ? <Brain className="w-3.5 h-3.5 text-purple-400" /> :
         node.name === "SOUL.md" ? <Dna className="w-3.5 h-3.5 text-emerald-400" /> :
         node.name === "AGENTS.md" ? <Bot className="w-3.5 h-3.5 text-blue-400" /> :
         node.name === "USER.md" ? <User className="w-3.5 h-3.5 text-amber-400" /> :
         node.name === "TOOLS.md" ? <Wrench className="w-3.5 h-3.5 text-gray-400" /> :
         node.name === "TODO.md" ? <ListTodo className="w-3.5 h-3.5 text-orange-400" /> :
         node.name === "HEARTBEAT.md" ? <HeartPulse className="w-3.5 h-3.5 text-red-400" /> :
         node.name === "IDENTITY.md" ? <IdCard className="w-3.5 h-3.5 text-cyan-400" /> :
         node.name === "BOOTSTRAP.md" ? <Settings className="w-3.5 h-3.5 text-gray-400" /> :
         <FileText className="w-3.5 h-3.5 text-gray-500" />}
      </span>
      <span className="truncate">{node.name}</span>
    </button>
  );
}
