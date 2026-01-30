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

import { agentRouter } from './agent';
import { DraftingAgent } from '../../../lib/agents/drafting-agent';

vi.mock('../../../lib/agents/drafting-agent');

describe('Agent tRPC Route', () => {
  it('should call DraftingAgent.generateDrafts', async () => {
    const mockGenerateDrafts = vi.fn().mockResolvedValue({ drafts: ['D1', 'D2'] });
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

    expect(mockGenerateDrafts).toHaveBeenCalledWith({ recipientEmail: 'test@example.com' });
    expect(result.drafts).toHaveLength(2);
  });
});