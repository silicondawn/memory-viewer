import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
  files: string[];
}

export default function Sidebar({ files }: SidebarProps) {
  const location = useLocation();
  const rootFiles = files.filter(f => !f.includes('/'));
  const memoryFiles = files.filter(f => f.startsWith('memory/'));

  const isActive = (path: string) => {
    // 解码 URL 里的 file 参数
    const search = new URLSearchParams(location.search);
    const currentFile = search.get('file');
    return location.pathname === '/file' && currentFile === path;
  };

  return (
    <div className="w-64 bg-[#161b22] border-r border-[#30363d] overflow-y-auto flex-shrink-0 py-4 h-full flex flex-col">
      <h2 className="px-4 pb-4 text-base font-semibold text-[#c9d1d9] flex items-center gap-2">
        ⚡ 01 Memory
      </h2>
      
      <Link 
        to="/" 
        className={`block px-4 py-2 text-sm border-l-[3px] transition-all ${
          location.pathname === '/' 
            ? 'bg-[#21262d] border-[#58a6ff] text-[#58a6ff]' 
            : 'border-transparent text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]'
        }`}
      >
        📊 Dashboard
      </Link>

      <div className="mt-4 px-4 pb-2 text-[11px] text-[#484f58] uppercase tracking-wider font-semibold">
        核心文件
      </div>
      {rootFiles.map(f => (
        <Link
          key={f}
          to={`/file?file=${encodeURIComponent(f)}`}
          className={`block px-4 py-2 text-sm border-l-[3px] transition-all truncate ${
            isActive(f)
              ? 'bg-[#21262d] border-[#58a6ff] text-[#58a6ff]'
              : 'border-transparent text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]'
          }`}
        >
          {f}
        </Link>
      ))}

      <div className="mt-4 px-4 pb-2 text-[11px] text-[#484f58] uppercase tracking-wider font-semibold">
        每日记忆 ({memoryFiles.length})
      </div>
      {memoryFiles.map(f => (
        <Link
          key={f}
          to={`/file?file=${encodeURIComponent(f)}`}
          className={`block px-4 py-2 text-sm border-l-[3px] transition-all truncate ${
            isActive(f)
              ? 'bg-[#21262d] border-[#58a6ff] text-[#58a6ff]'
              : 'border-transparent text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]'
          }`}
        >
          {f.replace('memory/', '')}
        </Link>
      ))}
    </div>
  );
}
