import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { app } from './index.js';

describe('Server API', () => {
  it('GET /api/info returns bot info', async () => {
    // Note: This relies on actual file system unless mocked.
    // Ideally we mock fs, but for integration test on CI it's fine.
    const res = await app.request('/api/info');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('version');
  });

  it('GET /api/agent/status returns structure', async () => {
    const res = await app.request('/api/agent/status');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('config');
    expect(data).toHaveProperty('gateway');
  });
});

describe('Backlinks API', () => {
  // These tests rely on the actual WORKSPACE directory (~/clawd by default)
  // They test the API structure and basic behavior

  it('GET /api/resolve-wikilink returns 400 without link', async () => {
    const res = await app.request('/api/resolve-wikilink');
    expect(res.status).toBe(400);
  });

  it('GET /api/resolve-wikilink resolves existing file', async () => {
    // MEMORY.md should exist in the workspace
    const res = await app.request('/api/resolve-wikilink?link=MEMORY');
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data).toHaveProperty('found');
    expect(data).toHaveProperty('path');
  });

  it('GET /api/resolve-wikilink returns not found for nonexistent', async () => {
    const res = await app.request('/api/resolve-wikilink?link=nonexistent-file-that-does-not-exist-12345');
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.found).toBe(false);
  });
});
