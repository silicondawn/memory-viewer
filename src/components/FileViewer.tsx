import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchFile, saveFile, FileData } from '../api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'github-markdown-css/github-markdown-dark.css';

export default function FileViewer() {
  const [searchParams] = useSearchParams();
  const filePath = searchParams.get('file');
  
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!filePath) return;
    load(filePath);
  }, [filePath]);

  const load = async (path: string) => {
    setLoading(true);
    setError(null);
    setIsEditing(false);
    setUnsaved(false);
    try {
      const data = await fetchFile(path);
      setFileData(data);
      setContent(data.content);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    // 等待 React 渲染 textarea 后聚焦
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleCancel = () => {
    if (unsaved && !confirm('放弃未保存的修改？')) return;
    setIsEditing(false);
    setContent(fileData?.content || '');
    setUnsaved(false);
  };

  const handleSave = async () => {
    if (!filePath) return;
    try {
      const res = await saveFile(filePath, content);
      if (res.ok) {
        setFileData({ ...fileData!, content, mtime: res.mtime });
        setIsEditing(false);
        setUnsaved(false);
        // 可以加个 Toast
      } else {
        alert('保存失败');
      }
    } catch (e) {
      console.error(e);
      alert('保存出错');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const t = e.target as HTMLTextAreaElement;
      const s = t.selectionStart, end = t.selectionEnd;
      const newVal = t.value.substring(0, s) + '  ' + t.value.substring(end);
      setContent(newVal);
      setUnsaved(true);
      // 需要在下一个 tick 设置光标位置
      setTimeout(() => {
        t.selectionStart = t.selectionEnd = s + 2;
      }, 0);
    }
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  if (!filePath) return <div className="p-8">请选择文件</div>;
  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto h-full flex flex-col">
      <div className="flex items-center gap-4 mb-6 pb-4 border-b border-[#30363d] flex-wrap">
        <h1 className={`text-xl font-semibold ${unsaved ? 'text-[#d29922]' : ''}`}>
          {filePath} {unsaved && '*'}
        </h1>
        <span className="text-sm text-[#8b949e]">
           {fileData && new Date(fileData.mtime).toLocaleString('zh-CN')}
        </span>
        
        <div className="ml-auto flex gap-2">
          {!isEditing ? (
            <button 
              onClick={handleEdit}
              className="px-3 py-1.5 bg-[#21262d] border border-[#30363d] rounded-md text-sm text-[#c9d1d9] hover:bg-[#30363d] transition-colors cursor-pointer"
            >
              ✏️ 编辑
            </button>
          ) : (
            <>
              <button 
                onClick={handleSave}
                className="px-3 py-1.5 bg-[#238636] border border-[#238636] rounded-md text-sm text-white hover:bg-[#2ea043] transition-colors cursor-pointer"
              >
                💾 保存
              </button>
              <button 
                onClick={handleCancel}
                className="px-3 py-1.5 bg-[#da3633] border border-[#da3633] rounded-md text-sm text-white hover:bg-[#f85149] transition-colors cursor-pointer"
              >
                ✖ 取消
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setUnsaved(true);
            }}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="w-full h-full bg-[#0d1117] text-[#c9d1d9] border border-[#30363d] rounded-lg p-4 font-mono text-sm leading-relaxed outline-none focus:border-[#58a6ff] resize-none"
          />
        ) : (
          <div className="markdown-body !bg-transparent !text-[#c9d1d9]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
