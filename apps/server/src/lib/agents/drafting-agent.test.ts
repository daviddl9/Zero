import { describe, it, expect, vi } from 'vitest';
import { DraftingAgent } from './drafting-agent';
import { generateText } from 'ai';

vi.mock('ai', () => ({
    generateText: vi.fn(),
    tool: vi.fn((def) => def),
}));

vi.mock('@ai-sdk/google', () => ({
    google: vi.fn(() => ({ id: 'google:gemini-2.0-flash' })),
}));

// Mock env to avoid import errors
vi.mock('../../env', () => ({
    env: {
        GOOGLE_GENERATIVE_AI_API_KEY: 'test-key'
    }
}));

// Mock tools logic to avoid actually calling them (even though tools are wrapped)
vi.mock('../../services/agent-tools', () => ({
  searchPastEmails: vi.fn(),
}));

describe('DraftingAgent', () => {
  it('should generate drafts using reasoning', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({ drafts: ['Draft 1', 'Draft 2'] }),
      toolCalls: [],
      toolResults: [],
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      response: {
        messages: [],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const agent = new DraftingAgent('conn-1', 'user@example.com');
    const drafts = await agent.generateDrafts({ recipientEmail: 'recipient@example.com' });

    expect(generateText).toHaveBeenCalled();
    expect(drafts).toBeDefined();
    expect(drafts.drafts).toHaveLength(2);
  });

  it('should handle invalid JSON response gracefully', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'Not valid JSON',
      toolCalls: [],
      toolResults: [],
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      response: {
        messages: [],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const agent = new DraftingAgent('conn-1', 'user@example.com');
    const result = await agent.generateDrafts({ recipientEmail: 'test@example.com' });

    expect(result.drafts).toHaveLength(2);
    expect(result.drafts[0]).toBe('Not valid JSON');
  });

  it('should construct prompt with user points when provided', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({ drafts: ['D1', 'D2'] }),
      toolCalls: [],
      toolResults: [],
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      response: { messages: [] }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const agent = new DraftingAgent('conn-1', 'user@example.com');
    await agent.generateDrafts({ recipientEmail: 'test@example.com', userPoints: 'Tell them I am running late.' });
    
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
        prompt: expect.stringContaining('User points: Tell them I am running late.')
    }));
  });

  it('should construct prompt for empty window when points are missing', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({ drafts: ['D1', 'D2'] }),
      toolCalls: [],
      toolResults: [],
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      response: { messages: [] }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const agent = new DraftingAgent('conn-1', 'user@example.com');
    await agent.generateDrafts({ recipientEmail: 'test@example.com' });
    
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
        prompt: expect.stringContaining('No specific points provided')
    }));
  });
});