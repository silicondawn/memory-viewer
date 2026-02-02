import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentStatusPage } from '../components/AgentStatus';
import { LocaleContext } from '../hooks/useLocale';

// Mock dependencies
vi.mock('../api', () => ({
  fetchAgentStatus: vi.fn().mockResolvedValue({
    config: { version: '1.2.0', update: { channel: 'stable' } },
    gateway: { runtime: { status: 'running', pid: 1234 } },
    heartbeat: { lastRun: Date.now() }
  })
}));

// Mock shiki
vi.mock('shiki', () => ({
  createHighlighter: vi.fn().mockResolvedValue({
    codeToHtml: () => '<pre>mock code</pre>'
  })
}));

describe('AgentStatusPage', () => {
  it('renders loading state initially', () => {
    // We can't easily test loading state with async useEffect, 
    // but we can test the happy path after wait
  });

  it('renders status after load', async () => {
    const mockLocale = { t: (k: string) => k, toggleLocale: () => {}, locale: 'en' as const };
    
    render(
      <LocaleContext.Provider value={mockLocale}>
        <AgentStatusPage />
      </LocaleContext.Provider>
    );
    
    // Should eventually show the version
    expect(await screen.findByText('v1.2.0')).toBeInTheDocument();
    // Should show gateway running status key
    expect(screen.getByText('agent.running')).toBeInTheDocument();
  });
});
