import { describe, it, expect, vi } from 'vitest';

// Mock cloudflare:workers
vi.mock('cloudflare:workers', () => ({
    env: {},
    DurableObject: class {}
}));

// Mock env
vi.mock('../../../env', () => ({
    env: {
        OPENAI_MODEL: 'gpt-4o',
        GOOGLE_GENERATIVE_AI_API_KEY: 'test-key'
    }
}));

// Mock trpc context/procedures
vi.mock('../../trpc', () => ({
    activeConnectionProcedure: {
        input: vi.fn().mockReturnThis(),
        mutation: vi.fn((handler) => ({
            mutation: handler // return the handler for testing
        })),
    },
    router: vi.fn((routes) => routes),
}));

// Mock searchPastEmails
vi.mock('../../../services/agent-tools', () => ({
    searchPastEmails: vi.fn().mockResolvedValue([
        { subject: 'Past convo', body: 'Hey!', date: '2024-01-01', to: ['test@example.com'], from: 'user@example.com', direction: 'sent' },
    ]),
}));

import { agentRouter } from './agent';
import { DraftingAgent } from '../../../lib/agents/drafting-agent';
import { searchPastEmails } from '../../../services/agent-tools';

vi.mock('../../../lib/agents/drafting-agent');

describe('Agent tRPC Route', () => {
  it('should call DraftingAgent.generateDrafts with pastEmails', async () => {
    const mockGenerateDrafts = vi.fn().mockResolvedValue({ drafts: ['D1', 'D2'], steps: [] });
    vi.mocked(DraftingAgent).mockImplementation(() => ({
      generateDrafts: mockGenerateDrafts,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any));

    const ctx = {
      activeConnection: { id: 'conn-1', email: 'user@example.com' },
      sessionUser: { name: 'User' },
    };

    const input = { recipientEmail: 'test@example.com' };

    // @ts-expect-error - testing internal call
    const result = await agentRouter.generateDrafts.mutation({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ctx: ctx as any,
        input,
    });

    expect(DraftingAgent).toHaveBeenCalledWith();
    expect(searchPastEmails).toHaveBeenCalledWith('test@example.com', 'conn-1', 'user@example.com');
    expect(mockGenerateDrafts).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: 'test@example.com',
      pastEmails: expect.arrayContaining([
        expect.objectContaining({ subject: 'Past convo' }),
      ]),
    }));
    expect(result.drafts).toHaveLength(2);
  });

  it('should skip searchPastEmails when no recipientEmail', async () => {
    const mockGenerateDrafts = vi.fn().mockResolvedValue({ drafts: ['D1', 'D2'], steps: [] });
    vi.mocked(DraftingAgent).mockImplementation(() => ({
      generateDrafts: mockGenerateDrafts,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any));
    vi.mocked(searchPastEmails).mockClear();

    const ctx = {
      activeConnection: { id: 'conn-1', email: 'user@example.com' },
      sessionUser: { name: 'User' },
    };

    // @ts-expect-error - testing internal call
    await agentRouter.generateDrafts.mutation({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ctx: ctx as any,
        input: {},
    });

    expect(searchPastEmails).not.toHaveBeenCalled();
    expect(mockGenerateDrafts).toHaveBeenCalledWith(expect.objectContaining({
      pastEmails: [],
    }));
  });
});
