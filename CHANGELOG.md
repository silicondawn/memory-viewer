# Changelog

All notable changes to Memory Viewer will be documented in this file.

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
