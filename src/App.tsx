import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import FileViewer from './components/FileViewer';
import { useEffect, useState } from 'react';
import { fetchFiles } from './api';

function App() {
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    fetchFiles().then(setFiles).catch(console.error);
  }, []);

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-[#0d1117] text-[#c9d1d9] font-sans">
        <Sidebar files={files} />
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/file" element={<FileViewer />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
