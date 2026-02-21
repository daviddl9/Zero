import { getZeroAgent, getThread } from '../lib/server-utils';

interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailResult {
  subject: string;
  body: string;
  date: string;
  to: string[];
  from: string;
  direction: 'sent' | 'received';
}

export const searchPastEmails = async (
  recipientEmail: string,
  connectionId: string,
  userEmail: string,
  limit: number = 10
) => {
  try {
    const { stub: agent } = await getZeroAgent(connectionId);

    // Build search query for conversations with these recipients
    const query = `(from:me to:${recipientEmail}) OR (from:${recipientEmail} to:me)`;

    // Search for matching threads
    const searchResult = await agent.searchThreads({
      query,
      maxResults: limit * 2, // Get more threads since we'll filter
      folder: 'all mail',
    });

    if (!searchResult.threadIds.length) {
      return [];
    }

    // Fetch thread details for each result
    const emails: Array<{
      subject: string;
      body: string;
      date: string;
      to: string[];
      from: string;
      direction: 'sent' | 'received';
    }> = [];

    for (const threadId of searchResult.threadIds.slice(0, limit)) {
      try {
        const { result: thread } = await getThread(connectionId, threadId);
        if (thread?.messages) {
          for (const message of thread.messages) {
             const isSent = message.sender.email?.toLowerCase() === userEmail.toLowerCase();

            emails.push({
              subject: message.subject || '',
              body: message.decodedBody?.slice(0, 2000) || '',
              date: message.receivedOn || '',
              to: (message.to as EmailRecipient[] | undefined)?.map((t) => t.email) || [],
              from: message.sender.email || '',
              direction: isSent ? 'sent' : 'received',
            });

            if (emails.length >= limit) break;
          }
        }
      } catch (error) {
        console.error(`[searchPastEmails] Error fetching thread ${threadId}:`, error);
      }
      if (emails.length >= limit) break;
    }

    return emails;
  } catch (error) {
    console.error('[searchPastEmails] Error:', error);
    return [];
  }
};
