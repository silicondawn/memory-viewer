import { useState } from "react";
import type { FileNode } from "../api";

interface FileTreeProps {
  nodes: FileNode[];
  activeFile: string;
  onSelect: (path: string) => void;
}

export function FileTree({ nodes, activeFile, onSelect }: FileTreeProps) {
  return (
    <nav className="text-sm" aria-label="File tree">
      {nodes.map((node) => (
        <TreeNode key={node.path} node={node} activeFile={activeFile} onSelect={onSelect} depth={0} />
      ))}
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
          className="flex items-center gap-1.5 w-full py-1.5 hover:bg-white/5 rounded-md text-gray-400 hover:text-gray-200 transition-colors"
          style={{ paddingLeft: `${indent}px` }}
        >
          <span className="text-[10px] w-3 text-center opacity-60">{open ? "▼" : "▶"}</span>
          <span className="truncate">{node.name}</span>
          {node.children && (
            <span className="text-[10px] text-gray-600 ml-auto mr-2">{node.children.length}</span>
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
        isActive
          ? "bg-blue-500/15 text-blue-300 font-medium"
          : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
      }`}
      style={{ paddingLeft: `${indent}px` }}
    >
      <span className="text-xs opacity-70">
        {node.name === "MEMORY.md" ? "🧠" : node.name === "SOUL.md" ? "🧬" : ""}
      </span>
      <span className="truncate">{node.name}</span>
    </button>
  );
}
