import { getZeroAgent, getThread } from '../lib/server-utils';

export const searchPastEmails = async (
  recipientEmail: string,
  connectionId: string,
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
             const isSent = message.sender.email?.toLowerCase() !== recipientEmail.toLowerCase();
             
             emails.push({
              subject: message.subject || '',
              body: message.decodedBody?.slice(0, 1000) || '',
              date: message.receivedOn || '',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              to: message.to?.map((t: any) => t.email) || [],
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const checkCalendar = async (_date: string): Promise<string> => {
    return "Calendar integration is not yet available. Please assume availability.";
};
