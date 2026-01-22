import { describe, it, expect, vi } from 'vitest';
import { searchPastEmails } from './agent-tools';

// Mock server-utils
vi.mock('../lib/server-utils', () => {
  return {
    getZeroAgent: vi.fn().mockResolvedValue({
      stub: {
        searchThreads: vi.fn().mockResolvedValue({
          threadIds: ['thread-1', 'thread-2']
        })
      }
    }),
    getThread: vi.fn().mockImplementation((connId, threadId) => {
        if (threadId === 'thread-1') {
            return Promise.resolve({
                result: {
                    messages: [
                        {
                            subject: 'Hello',
                            decodedBody: 'Hi there',
                            receivedOn: '2023-01-01',
                            to: [{ email: 'recipient@example.com' }],
                            sender: { email: 'me@example.com' }
                        }
                    ]
                }
            });
        }
        return Promise.resolve({ result: { messages: [] } });
    })
  };
});

describe('Agent Tools', () => {
  describe('searchPastEmails', () => {
    it('should return a structured list of emails', async () => {
      const emails = await searchPastEmails('recipient@example.com', 'conn-1', 'me@example.com');

      expect(Array.isArray(emails)).toBe(true);
      expect(emails.length).toBeGreaterThan(0);
      expect(emails[0].subject).toBe('Hello');
      expect(emails[0].direction).toBe('sent');
    });

    it('should mark emails FROM recipient as received', async () => {
      const emails = await searchPastEmails('me@example.com', 'conn-1', 'other@example.com');
      expect(emails[0].direction).toBe('received');
    });
  });
});
