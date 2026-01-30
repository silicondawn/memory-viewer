import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import cors from 'cors';
import { fileURLToPath } from 'url';

// 配置
const PORT = 3001;
// 在开发环境中，我们假设 WORKSPACE 是 Clawd 的工作目录，方便测试
// 在生产环境中，可能是当前目录
const WORKSPACE = process.env.WORKSPACE || '/home/yibo/clawd'; 

const app = express();
app.use(cors());
app.use(express.json());

// 工具函数：获取文件列表
function getFiles() {
  const files: string[] = [];
  try {
    if (fs.existsSync(WORKSPACE)) {
      for (const f of fs.readdirSync(WORKSPACE)) {
        if (f.endsWith('.md')) files.push(f);
      }
      const memDir = path.join(WORKSPACE, 'memory');
      if (fs.existsSync(memDir)) {
        for (const f of fs.readdirSync(memDir).sort().reverse()) {
          if (f.endsWith('.md')) files.push('memory/' + f);
        }
      }
    }
  } catch (e) { console.error(e); }
  return files;
}

// 工具函数：获取系统状态
function getSystemStats() {
  return {
    uptime: os.uptime(),
    load: os.loadavg(),
    memTotal: os.totalmem(),
    memFree: os.freemem(),
    platform: os.platform() + ' ' + os.release()
  };
}

// 工具函数：获取今日记忆
function getTodayMemory() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const filename = `memory/${dateStr}.md`;
  const fullPath = path.join(WORKSPACE, filename);
  
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf-8');
    // 提取前 10 行
    const snippet = content.split('\n').slice(0, 10).join('\n');
    return { exists: true, filename, snippet, length: content.length };
  }
  return { exists: false, filename };
}

// 工具函数：安全路径检查
function safePath(file: string): string | null {
  if (!file || file.includes('..') || !file.endsWith('.md')) return null;
  const full = path.join(WORKSPACE, file);
  if (!full.startsWith(WORKSPACE)) return null;
  return full;
}

// API: Dashboard 数据
app.get('/api/dashboard', (req, res) => {
  const data = {
    stats: getSystemStats(),
    today: getTodayMemory(),
    filesCount: getFiles().length
  };
  res.json(data);
});

// API: 文件列表
app.get('/api/files', (req, res) => {
  res.json(getFiles());
});

// API: 读取文件
app.get('/api/file', (req, res) => {
  const filepath = req.query.path as string;
  const full = safePath(filepath);
  
  if (!full) {
    res.status(400).send('Bad path');
    return;
  }
  
  if (!fs.existsSync(full)) {
    res.status(404).send('Not found');
    return;
  }
  
  const content = fs.readFileSync(full, 'utf-8');
  const stat = fs.statSync(full);
  res.json({ content, mtime: stat.mtime });
});

// API: 写入文件
app.put('/api/file', (req, res) => {
  const { path: filepath, content } = req.body;
  const full = safePath(filepath);
  
  if (!full) {
    res.status(400).send('Bad path');
    return;
  }
  
  // 允许创建 memory/ 下的新文件
  if (!fs.existsSync(full) && !filepath.startsWith('memory/')) {
    res.status(404).send('Not found (creation only allowed in memory/)');
    return;
  }

  // 确保目录存在
  const dir = path.dirname(full);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(full, content, 'utf-8');
  const stat = fs.statSync(full);
  res.json({ ok: true, mtime: stat.mtime });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Workspace: ${WORKSPACE}`);
});
