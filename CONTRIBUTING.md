# Contributing to Memory Viewer

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. **Prerequisites:** Node.js >= 18, npm
2. Clone and install:
   ```bash
   git clone https://github.com/silicondawn/memory-viewer.git
   cd memory-viewer
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
   This runs both the API server and Vite dev server concurrently.

## Submitting Pull Requests

1. Fork the repo and create a feature branch from `master`:
   ```bash
   git checkout -b feat/my-feature
   ```
2. Make your changes and ensure they pass type checking:
   ```bash
   npm run typecheck
   ```
3. Commit with a clear message following [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` for new features
   - `fix:` for bug fixes
   - `chore:` for maintenance tasks
   - `docs:` for documentation changes
4. Push and open a PR against `master`.

## Code Style

- **TypeScript** — All new code should be written in TypeScript.
- **React** — Functional components with hooks.
- **Tailwind CSS v4** — Use utility classes; avoid custom CSS when possible.
- **Formatting** — Keep lines reasonable (~100 chars). No trailing whitespace.
- Run `npm run typecheck` before committing.

## Reporting Issues

- Use the [Bug Report](https://github.com/silicondawn/memory-viewer/issues/new?template=bug_report.md) or [Feature Request](https://github.com/silicondawn/memory-viewer/issues/new?template=feature_request.md) templates.
- Include steps to reproduce, expected vs actual behavior, and your environment (OS, Node version, browser).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
