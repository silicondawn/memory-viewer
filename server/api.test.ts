import { describe, it, expect } from 'vitest';
import { app } from '../server/index';

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
