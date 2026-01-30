import { useEffect, useState } from 'react';
import { fetchDashboard, DashboardData, saveFile } from '../api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboard().then(setData).catch(console.error);
  }, []);

  const createToday = async () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const filename = `memory/${dateStr}.md`;
    const content = `# ${dateStr}\n\n`;
    
    try {
      await saveFile(filename, content);
      navigate(`/file?file=${encodeURIComponent(filename)}`);
    } catch (e) {
      alert('创建失败: ' + e);
    }
  };

  if (!data) return <div className="p-8 text-[#8b949e]">Loading...</div>;

  const memUsed = ((data.stats.memTotal - data.stats.memFree) / 1024 / 1024 / 1024).toFixed(2);
  const memTotal = (data.stats.memTotal / 1024 / 1024 / 1024).toFixed(2);
  const uptime = (data.stats.uptime / 3600).toFixed(1);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#30363d]">
        <h1 className="text-2xl font-semibold">👋 Hi Yibo, System Online</h1>
        <button 
          onClick={() => fetchDashboard().then(setData)}
          className="px-3 py-1.5 bg-[#21262d] border border-[#30363d] rounded-md text-sm text-[#c9d1d9] hover:bg-[#30363d] transition-colors cursor-pointer"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* System Stats */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-5">
          <h3 className="text-[#58a6ff] font-semibold mb-4 flex items-center gap-2">
            🖥️ System Status
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[#8b949e]">Uptime</span>
              <span className="font-mono font-semibold">{uptime} hours</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8b949e]">Memory</span>
              <span className="font-mono font-semibold">{memUsed} / {memTotal} GB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8b949e]">Load Avg</span>
              <span className="font-mono font-semibold">{data.stats.load[0].toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8b949e]">OS</span>
              <span className="font-mono font-semibold">{data.stats.platform}</span>
            </div>
          </div>
        </div>

        {/* Today's Memory */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-5">
          <h3 className="text-[#58a6ff] font-semibold mb-4 flex items-center gap-2">
            📅 Today's Context
          </h3>
          {data.today.exists ? (
            <div>
              <div className="mb-2 text-sm">
                <span className="text-[#8b949e] mr-2">File</span>
                <a 
                  href="#" 
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`/file?file=${encodeURIComponent(data.today.filename)}`);
                  }}
                  className="text-[#58a6ff] hover:underline"
                >
                  {data.today.filename}
                </a>
              </div>
              <div className="bg-[#0d1117] border border-[#30363d] rounded p-3 text-xs text-[#8b949e] max-h-[150px] overflow-hidden relative">
                 <ReactMarkdown remarkPlugins={[remarkGfm]}>
                   {data.today.snippet || ''}
                 </ReactMarkdown>
                 <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#0d1117] to-transparent pointer-events-none"></div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-start">
              <div className="text-[#8b949e] text-sm mb-3">No memory file for today yet.</div>
              <button 
                onClick={createToday}
                className="px-3 py-1.5 bg-[#238636] text-white rounded-md text-sm hover:bg-[#2ea043] transition-colors cursor-pointer"
              >
                Create Now
              </button>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-5">
          <h3 className="text-[#58a6ff] font-semibold mb-4 flex items-center gap-2">
            🚀 Quick Actions
          </h3>
          <div className="flex flex-wrap gap-2">
            {['NIGHTBUILDS.md', 'TODO.md', 'HEARTBEAT.md'].map(file => (
              <button
                key={file}
                onClick={() => navigate(`/file?file=${encodeURIComponent(file)}`)}
                className="px-3 py-1.5 bg-[#21262d] border border-[#30363d] rounded-md text-sm text-[#c9d1d9] hover:bg-[#30363d] transition-colors cursor-pointer"
              >
                {file.replace('.md', '')}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
