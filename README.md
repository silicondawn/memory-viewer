[中文](./README.zh-CN.md) | **English**

# 📝 Memory Viewer

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
[![Version](https://img.shields.io/badge/version-1.2.0-orange.svg)](https://github.com/silicondawn/memory-viewer/releases/tag/v1.2.0)

A beautiful, dark-themed web UI for browsing and editing an AI agent's memory files. Built for [OpenClaw](https://openclaw.com) agents that store context in Markdown files.

<p align="center">
  <img src="./docs/screenshot-dashboard-dark.png" width="48%" alt="Dashboard (Dark)">
  <img src="./docs/screenshot-dashboard-light.png" width="48%" alt="Dashboard (Light)">
</p>
<p align="center">
  <img src="./docs/screenshot-viewer-dark.png" width="48%" alt="Viewer (Dark)">
  <img src="./docs/screenshot-viewer-light.png" width="48%" alt="Viewer (Light)">
</p>
<p align="center">
  <img src="./docs/screenshot-editor-dark.png" width="48%" alt="Editor">
  <img src="./docs/screenshot-search-dark.png" width="48%" alt="Search">
</p>

## Features

- **📁 File Tree Sidebar** — Navigate all `.md` files in a collapsible tree
- **📖 Markdown Rendering** — GitHub-flavored Markdown with syntax highlighting, tables, and more
- **✏️ In-Browser Editing** — Edit files directly with Ctrl+S to save, with optimistic locking for conflict detection
- **🔍 Full-Text Search** — Search across all memory files instantly (Ctrl+K)
- **📊 System Dashboard** — Server uptime, memory usage, load averages, and today's memory summary
- **🔄 Live Reload** — Files auto-refresh when changed on disk (via WebSocket), with 10s polling fallback
- **📱 PWA Support** — Installable as a standalone app with offline caching
- **🔗 Deep Linking** — Hash-based routing (`#/file/path`) for bookmarkable file URLs
- **📊 Mermaid Diagrams** — Render flowcharts and diagrams from fenced code blocks
- **🚗 Large Screen Optimized** — Touch-friendly UI for car displays (Tesla) and large screens
- **🌙 Dark/Light Theme** — Toggle between themes, designed for always-on dashboards
- **📱 Responsive** — Works on mobile with a slide-out sidebar
- **🌐 Multi-bot Connections** — Connect to multiple OpenClaw agent workspaces from a single UI

## Quick Start

```bash
# Clone
git clone https://github.com/silicondawn/memory-viewer.git
cd memory-viewer

# Install
npm install

# Run (starts both API server and Vite dev server)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Configuration

Set environment variables to customize:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API server port |
| `WORKSPACE_DIR` | `~/clawd` | Root directory containing `.md` files |
| `STATIC_DIR` | `./dist` | Directory for built frontend assets |

## Production

```bash
# Build the frontend
npm run build

# Start the production server (serves API + static files)
PORT=8901 npm start
```

The production server serves both the API and the built frontend from a single process.

## Architecture

```
memory-viewer/
├── server/           # Hono API + WebSocket server
│   └── index.ts      # File browsing, search, system info, live reload
├── src/              # React frontend (Vite + Tailwind)
│   ├── App.tsx       # Main layout with responsive sidebar
│   ├── api.ts        # API client
│   ├── hooks/        # Custom React hooks
│   │   └── useWebSocket.ts
│   └── components/
│       ├── Dashboard.tsx    # System overview + today's memory
│       ├── FileTree.tsx     # Recursive file tree navigation
│       ├── FileViewer.tsx   # Markdown renderer + editor
│       └── SearchPanel.tsx  # Full-text search modal
├── public/           # PWA manifest + icons
└── package.json
```

**Backend:** [Hono](https://hono.dev) serves a REST API for file operations and a WebSocket endpoint for live file-change notifications (powered by chokidar).

**Frontend:** React 19 + Tailwind CSS 4 + Vite 7. Markdown rendered with react-markdown and remark-gfm. Diagrams rendered with Mermaid. Editor powered by CodeMirror (lazy-loaded).

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/files` | List all `.md` files as a tree |
| `GET` | `/api/file?path=...` | Read a file's content + mtime |
| `PUT` | `/api/file` | Save a file (`{ path, content, expectedMtime }`) |
| `GET` | `/api/search?q=...` | Full-text search across all files |
| `GET` | `/api/recent?limit=10` | Recently modified files |
| `GET` | `/api/stats/monthly` | Monthly file count distribution |
| `GET` | `/api/info` | Bot identity from SOUL.md / IDENTITY.md |
| `GET` | `/api/system` | System info and today's memory |
| `POST` | `/api/gateway/chat` | Proxy chat requests to OpenClaw Gateway |
| `WS` | `/ws` | Live file-change notifications |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` / `⌘K` | Open search |
| `Ctrl+S` / `⌘S` | Save file (in edit mode) |
| `Escape` | Close search |

## License

MIT © [Silicon Dawn](https://github.com/silicondawn)
