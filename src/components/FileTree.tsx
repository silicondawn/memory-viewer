import { useState, useMemo } from "react";
import type { FileNode } from "../api";
import { ChevronDown, ChevronRight, Folder, FileText, Brain, Dna, Bot, User, Wrench, ListTodo, HeartPulse, IdCard, Settings } from "lucide-react";

/** Well-known bot config files shown in the top section */
const BOT_FILES = new Set([
  "AGENTS.md", "SOUL.md", "MEMORY.md", "USER.md", "TOOLS.md",
  "TODO.md", "HEARTBEAT.md", "IDENTITY.md", "BOOTSTRAP.md",
]);

function isBotFile(name: string): boolean {
  return BOT_FILES.has(name);
}

interface FileTreeProps {
  nodes: FileNode[];
  activeFile: string;
  onSelect: (path: string) => void;
}

export function FileTree({ nodes, activeFile, onSelect }: FileTreeProps) {
  const { botFiles, otherNodes } = useMemo(() => {
    const bot: FileNode[] = [];
    const other: FileNode[] = [];
    for (const node of nodes) {
      if (node.type === "file" && isBotFile(node.name)) {
        bot.push(node);
      } else {
        other.push(node);
      }
    }
    // Sort bot files in a logical order
    const order = [...BOT_FILES];
    bot.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
    return { botFiles: bot, otherNodes: other };
  }, [nodes]);

  return (
    <nav className="text-sm" aria-label="File tree">
      {botFiles.length > 0 && (
        <div className="mb-3">
          <div className="sidebar-section-title px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider">
            Agent Config
          </div>
          {botFiles.map((node) => (
            <TreeNode key={node.path} node={node} activeFile={activeFile} onSelect={onSelect} depth={0} />
          ))}
        </div>
      )}
      {otherNodes.length > 0 && (
        <div>
          <div className="sidebar-section-title px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider">
            Files
          </div>
          {otherNodes.map((node) => (
            <TreeNode key={node.path} node={node} activeFile={activeFile} onSelect={onSelect} depth={0} />
          ))}
        </div>
      )}
    </nav>
  );
}

function TreeNode({ node, activeFile, onSelect, depth }: {
  node: FileNode;
  activeFile: string;
  onSelect: (path: string) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(depth === 0);
  const indent = depth * 12 + 8;

  if (node.type === "dir") {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="sidebar-item flex items-center gap-1.5 w-full py-1.5 rounded-md"
          style={{ paddingLeft: `${indent}px` }}
        >
          {open ? <ChevronDown className="w-3 h-3 opacity-60 shrink-0" /> : <ChevronRight className="w-3 h-3 opacity-60 shrink-0" />}
          <span className="truncate">{node.name}</span>
          {node.children && (
            <span className="text-[10px] ml-auto mr-2" style={{ color: "var(--text-faint)" }}>{node.children.length}</span>
          )}
        </button>
        {open && node.children?.map((child) => (
          <TreeNode key={child.path} node={child} activeFile={activeFile} onSelect={onSelect} depth={depth + 1} />
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
