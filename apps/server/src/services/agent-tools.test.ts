import { describe, it, expect, vi } from 'vitest';
import { searchPastEmails, checkCalendar } from './agent-tools';

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
        const emails = await searchPastEmails('recipient@example.com', 'conn-1');
        
        expect(Array.isArray(emails)).toBe(true);
        expect(emails.length).toBeGreaterThan(0);
        expect(emails[0].subject).toBe('Hello');
        expect(emails[0].direction).toBe('sent');
    });
  });

  describe('checkCalendar', () => {
    it('should return a status string', async () => {
        const result = await checkCalendar('2023-10-27');
        expect(typeof result).toBe('string');
        expect(result).toContain('Calendar integration');
    });
  });
});
