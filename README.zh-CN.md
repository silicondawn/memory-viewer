**中文** | [English](./README.md)

# 📝 Memory Viewer for OpenClaw

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
[![Version](https://img.shields.io/badge/version-1.2.0-orange.svg)](https://github.com/silicondawn/memory-viewer/releases/tag/v1.2.0)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-兼容-blue)](https://openclaw.com)

一个精美的暗色主题 Web UI，用于浏览和编辑 OpenClaw AI Agent 的记忆文件。专为使用 Markdown 文件存储上下文的 [OpenClaw](https://openclaw.com) Agent 设计。

<p align="center">
  <img src="./docs/screenshot-dashboard-dark.png" width="48%" alt="仪表盘（暗色）">
  <img src="./docs/screenshot-dashboard-light.png" width="48%" alt="仪表盘（亮色）">
</p>
<p align="center">
  <img src="./docs/screenshot-viewer-dark.png" width="48%" alt="阅读模式（暗色）">
  <img src="./docs/screenshot-viewer-light.png" width="48%" alt="阅读模式（亮色）">
</p>
<p align="center">
  <img src="./docs/screenshot-editor-dark.png" width="48%" alt="编辑模式">
  <img src="./docs/screenshot-search-dark.png" width="48%" alt="搜索面板">
</p>

## 为什么选择 Memory Viewer for OpenClaw？

OpenClaw Agent 将记忆存储在 Markdown 文件中（`MEMORY.md`、`memory/*.md`）。Memory Viewer 提供了一个专用的 Web 界面来：

- **浏览** 记忆文件的折叠树形结构
- **搜索** 所有 Agent 记忆，即时查找
- **编辑** 直接在浏览器中修改文件
- **监控** Agent 系统状态和内存使用情况
- **连接** 从单个 UI 连接多个 OpenClaw Agent

## 功能特性

- **📁 文件树侧栏** — 可折叠的树形结构，浏览所有 `.md` 文件
- **📖 Markdown 渲染** — 支持 GFM（GitHub 风格 Markdown），包括语法高亮、表格等
- **✏️ 浏览器内编辑** — 直接在页面编辑文件，Ctrl+S 保存，支持乐观锁冲突检测
- **🔍 全文搜索** — 即时搜索所有记忆文件（Ctrl+K）
- **📊 系统仪表盘** — 服务器运行时间、内存使用、负载均值、今日记忆摘要
- **🔄 实时刷新** — 文件在磁盘上变更时自动刷新（WebSocket + 10 秒轮询兜底）
- **📱 PWA 支持** — 可安装为独立应用，支持离线缓存
- **🔗 深度链接** — 基于 Hash 路由（`#/file/路径`），可收藏和分享文件 URL
- **📊 Mermaid 图表** — 在围栏代码块中渲染流程图和各类图表
- **🚗 大屏优化** — 触控友好的 UI，适配车载屏幕（Tesla）和大型显示器
- **🌙 暗色/亮色主题** — 一键切换，适合常驻仪表盘
- **📱 响应式设计** — 移动端支持侧滑菜单
- **🌐 多 Bot 连接** — 在单个 UI 中连接多个 OpenClaw Agent 工作区

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/silicondawn/memory-viewer.git
cd memory-viewer

# 安装依赖
npm install

# 启动开发服务器（同时启动 API 和 Vite）
npm run dev
```

然后在浏览器中打开 http://localhost:5173。

## OpenClaw 集成

Memory Viewer 与 OpenClaw Agent 无缝集成。连接到你的 OpenClaw Agent：

1. 确保你的 OpenClaw Agent 正在运行且可访问
2. 在 Memory Viewer 中，点击右上角的网络图标
3. 添加你的 Agent 工作区路径（例如 `/home/user/clawd`）
4. 开始浏览和编辑你的 Agent 记忆文件

## 部署

Memory Viewer 可以作为独立服务部署：

```bash
# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

服务器默认运行在 8901 端口。你可以通过 Cloudflare Tunnel、Nginx 或任何反向代理暴露它。

## 许可证

MIT © Silicon Dawn