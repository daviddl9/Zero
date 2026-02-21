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

describe('DraftingAgent', () => {
  it('should generate drafts with structured response', async () => {
    const mockResponse = {
      drafts: [
        { approach: 'Accept meeting', body: 'Hi, I would be happy to attend...', to: [], cc: [] },
        { approach: 'Decline meeting', body: 'Thank you for the invitation, but...', cc: ['manager@example.com'] }
      ]
    };

    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify(mockResponse),
      toolCalls: [],
      toolResults: [],
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      response: {
        messages: [],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const agent = new DraftingAgent();
    const result = await agent.generateDrafts({
      recipientEmail: 'recipient@example.com',
      pastEmails: [
        { subject: 'Hello', body: 'Hi there', date: '2024-01-01', to: ['recipient@example.com'], from: 'user@example.com', direction: 'sent' },
      ],
    });

    expect(generateText).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.drafts).toHaveLength(2);
    expect(result.drafts[0].approach).toBe('Accept meeting');
    expect(result.drafts[0].body).toContain('happy to attend');
    expect(result.drafts[1].cc).toEqual(['manager@example.com']);
    expect(result.steps).toEqual([]);
  });

  it('should handle drafts with to and cc recipients', async () => {
    const mockResponse = {
      drafts: [
        {
          approach: 'Forward to team',
          body: 'Forwarding this for your review.',
          to: ['team@example.com'],
          cc: ['boss@example.com', 'lead@example.com']
        },
        {
          approach: 'Reply directly',
          body: 'Thanks for your message.',
        }
      ]
    };

    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify(mockResponse),
      toolCalls: [],
      toolResults: [],
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      response: { messages: [] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const agent = new DraftingAgent();
    const result = await agent.generateDrafts({ recipientEmail: 'test@example.com' });

    expect(result.drafts[0].to).toEqual(['team@example.com']);
    expect(result.drafts[0].cc).toEqual(['boss@example.com', 'lead@example.com']);
    expect(result.drafts[1].to).toBeUndefined();
    expect(result.drafts[1].cc).toBeUndefined();
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

    const agent = new DraftingAgent();
    const result = await agent.generateDrafts({ recipientEmail: 'test@example.com' });

    expect(result.drafts).toHaveLength(2);
    expect(result.drafts[0].body).toBe('Not valid JSON');
    expect(result.drafts[0].approach).toBe('Generated response');
    expect(result.steps).toEqual([]);
  });

  it('should construct prompt with user points when provided', async () => {
    const mockResponse = {
      drafts: [
        { approach: 'Option A', body: 'D1' },
        { approach: 'Option B', body: 'D2' }
      ]
    };

    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify(mockResponse),
      toolCalls: [],
      toolResults: [],
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      response: { messages: [] }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const agent = new DraftingAgent();
    await agent.generateDrafts({ recipientEmail: 'test@example.com', userPoints: 'Tell them I am running late.' });

    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
        prompt: expect.stringContaining('The user wants to: Tell them I am running late.')
    }));
  });

  it('should construct prompt for empty window when points are missing', async () => {
    const mockResponse = {
      drafts: [
        { approach: 'Option A', body: 'D1' },
        { approach: 'Option B', body: 'D2' }
      ]
    };

    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify(mockResponse),
      toolCalls: [],
      toolResults: [],
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      response: { messages: [] }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const agent = new DraftingAgent();
    await agent.generateDrafts({ recipientEmail: 'test@example.com' });

    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
        prompt: expect.stringContaining('No specific instructions provided')
    }));
  });

  it('should handle drafts with optional subject', async () => {
    const mockResponse = {
      drafts: [
        { approach: 'New subject', body: 'Content here', subject: 'Updated: Meeting Request' },
        { approach: 'Keep subject', body: 'Other content' }
      ]
    };

    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify(mockResponse),
      toolCalls: [],
      toolResults: [],
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      response: { messages: [] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const agent = new DraftingAgent();
    const result = await agent.generateDrafts({ recipientEmail: 'test@example.com' });

    expect(result.drafts[0].subject).toBe('Updated: Meeting Request');
    expect(result.drafts[1].subject).toBeUndefined();
  });

  it('should include past emails in prompt context', async () => {
    const mockResponse = {
      drafts: [
        { approach: 'Option A', body: 'D1' },
        { approach: 'Option B', body: 'D2' }
      ]
    };

    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify(mockResponse),
      toolCalls: [],
      toolResults: [],
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      response: { messages: [] }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const agent = new DraftingAgent();
    await agent.generateDrafts({
      recipientEmail: 'test@example.com',
      pastEmails: [
        { subject: 'Previous chat', body: 'Hey, how are you?', date: '2024-01-15', to: ['test@example.com'], from: 'user@example.com', direction: 'sent' },
        { subject: 'Re: Previous chat', body: 'Doing well!', date: '2024-01-16', to: ['user@example.com'], from: 'test@example.com', direction: 'received' },
      ],
    });

    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('PAST EMAILS WITH RECIPIENT'),
    }));
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('Previous chat'),
    }));
  });
});
