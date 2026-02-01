# Changelog

All notable changes to Memory Viewer will be documented in this file.

## [1.2.0] "Road Trip" - 2026-02-01

### Added
- **PWA support** — Installable as standalone app on mobile, desktop, and Tesla. Offline caching with service worker.
- **Hash-based routing** — URL updates to `#/file/<path>` when opening files. Refresh restores active file, browser back/forward works.
- **Mermaid diagram rendering** — Fenced `mermaid` code blocks render as SVG diagrams with theme-aware styling.
- **Auto-refresh polling** — Files auto-poll every 10s as WebSocket fallback. Manual refresh button in toolbar.

### Changed
- **Express → Hono migration** — Replaced Express + compression + cors with Hono (~14KB). Faster, lighter, better TypeScript support.
- **Monospace font fix** — Code blocks now enforce `var(--font-mono)` for proper CJK alignment in ASCII art.

### Performance
- **Gzip compression** — Server-side compression middleware.
- **CodeMirror lazy loading** — First-paint gzip reduced from 535KB → 310KB.
- **Vendor chunk splitting** — Separate chunks for react, codemirror, markdown, icons.
- **Tesla/large screen optimization** — 24px base font, 56px touch targets, wider sidebar.

### Fixed
- Code blocks without language tag now render properly with `<pre><code>` instead of inline code.

## [1.1.0] - 2026-01-31

### Added
- **Optimistic locking for concurrent edits** — When saving a file that was modified on disk while you were editing, a conflict dialog appears with options to Overwrite, Reload, or Cancel. Prevents accidental data loss when the agent writes to a file during human editing.
- **Changelog page** — In-app changelog accessible from the sidebar footer.

## [1.0.0] - 2026-01-30

### Added
- **Multi-bot remote connections** — Connect to multiple OpenClaw agent workspaces from a single UI. One-click setup via Gateway API bootstrap.
- **Markdown editor** — In-browser editing with Ctrl+S to save.
- **Full-text search** — Search across all memory files instantly (Ctrl+K).
- **System dashboard** — Server uptime, memory usage, load averages, today's memory summary, recent files, and monthly activity chart.
- **Live reload** — Files auto-refresh when changed on disk via WebSocket.
- **Dark/light theme** — Toggle between dark and light themes.
- **Sensitive content masking** — Blur/reveal sensitive text with one click.
- **i18n support** — English and Chinese interface.
- **Syntax highlighting** — Code blocks with Prism.js, copy button, line numbers.
- **File tree sidebar** — Navigate all `.md` files in a collapsible tree with grouping.
- **Responsive design** — Works on mobile with a slide-out sidebar.
- **Bot identity display** — Reads from SOUL.md / IDENTITY.md.
