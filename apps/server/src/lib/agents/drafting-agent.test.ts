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
    checkCalendar: vi.fn(),
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
                messages: []
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        const agent = new DraftingAgent('conn-1');
        const drafts = await agent.generateDrafts({ recipientEmail: 'recipient@example.com' });
        
        expect(generateText).toHaveBeenCalled();
        expect(drafts).toBeDefined();
        expect(drafts.drafts).toHaveLength(2);
    });
});