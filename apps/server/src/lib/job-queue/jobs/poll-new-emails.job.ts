/**
 * Poll New Emails Job
 *
 * Polls Gmail for new emails using the history API and triggers
 * workflow evaluation for any new messages found.
 *
 * This job runs on a schedule (every 2 minutes) and processes all
 * active connections. It's designed for standalone mode where Gmail
 * push notifications are not available.
 */

import type { Job } from 'bullmq';
import type { PollNewEmailsJobData, PollNewEmailsResult } from './types';

interface Connection {
  id: string;
  userId: string;
  email: string;
  accessToken: string | null;
  refreshToken: string | null;
  providerId: string;
}

interface MailDriver {
  list(params: {
    folder: string;
    maxResults?: number;
  }): Promise<{ threads: Array<{ id: string; historyId: string | null }>; nextPageToken: string | null }>;
  listHistory<T>(historyId: string): Promise<{ history: T[]; historyId: string }>;
}

interface HistoryItem {
  messagesAdded?: Array<{ message?: { threadId?: string; labelIds?: string[] } }>;
}

interface ThreadData {
  sender: string;
  receivedOn: string;
  subject: string;
  tags: Array<{ id: string; name: string }>;
  unread: boolean;
  body: string;
}

interface TriggerData {
  id: string;
  subject: string;
  sender: string;
  labels: Array<{ id: string; name: string }>;
  receivedOn: string;
  unread: boolean;
  body: string;
}

export interface PollNewEmailsDependencies {
  getAllConnections: () => Promise<Connection[]>;
  getHistoryId: (connectionId: string) => Promise<string | null>;
  setHistoryId: (connectionId: string, historyId: string) => Promise<void>;
  getDriver: (connection: Connection) => MailDriver | null;
  syncThread: (connectionId: string, threadId: string) => Promise<ThreadData | null>;
  evaluateTriggers: (connectionId: string, threadData: TriggerData) => Promise<void>;
  invalidateInboxCache: (connectionId: string) => Promise<void>;
}

/**
 * Create the poll new emails processor with dependencies injected
 */
export function createPollNewEmailsProcessor(deps: PollNewEmailsDependencies) {
  return async (job: Job<PollNewEmailsJobData>): Promise<PollNewEmailsResult> => {
    console.log('[PollNewEmailsJob] Starting email poll for all connections');

    const result: PollNewEmailsResult = {
      connectionsProcessed: 0,
      newThreadsFound: 0,
      errors: [],
    };

    let connections: Connection[];
    try {
      connections = await deps.getAllConnections();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[PollNewEmailsJob] Failed to get connections:', errorMessage);
      result.errors?.push(`Failed to get connections: ${errorMessage}`);
      return result;
    }

    console.log(`[PollNewEmailsJob] Found ${connections.length} active connections`);
    job.updateProgress(10);

    const progressPerConnection = 80 / Math.max(connections.length, 1);

    for (let i = 0; i < connections.length; i++) {
      const connection = connections[i];

      try {
        const newThreads = await processConnection(connection, deps);
        result.newThreadsFound += newThreads;
        result.connectionsProcessed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(
          `[PollNewEmailsJob] Error processing connection ${connection.id}:`,
          errorMessage,
        );
        result.errors?.push(`Connection ${connection.id}: ${errorMessage}`);
      }

      job.updateProgress(10 + (i + 1) * progressPerConnection);
    }

    job.updateProgress(100);
    console.log(
      `[PollNewEmailsJob] Completed: ${result.connectionsProcessed} connections, ${result.newThreadsFound} new threads`,
    );

    return result;
  };
}

async function processConnection(
  connection: Connection,
  deps: PollNewEmailsDependencies,
): Promise<number> {
  const driver = deps.getDriver(connection);
  if (!driver) {
    console.warn(`[PollNewEmailsJob] No driver for connection ${connection.id}`);
    return 0;
  }

  // Get last known history ID
  const lastHistoryId = await deps.getHistoryId(connection.id);

  if (!lastHistoryId) {
    // First run - get historyId from latest thread and save it as baseline
    console.log(`[PollNewEmailsJob] First poll for ${connection.email}, establishing baseline`);

    try {
      // Get latest thread to extract historyId as baseline
      const listResult = await driver.list({ folder: 'inbox', maxResults: 1 });
      const latestThread = listResult.threads[0];
      if (latestThread?.historyId) {
        await deps.setHistoryId(connection.id, latestThread.historyId);
        console.log(`[PollNewEmailsJob] Set baseline historyId ${latestThread.historyId} for ${connection.email}`);
      }
    } catch (error) {
      console.warn(`[PollNewEmailsJob] Failed to get baseline for ${connection.email}:`, error);
    }

    return 0;
  }

  // Check for new messages since last poll
  let history: HistoryItem[];
  let newHistoryId: string;

  try {
    const historyResult = await driver.listHistory<HistoryItem>(lastHistoryId);
    history = historyResult.history;
    newHistoryId = historyResult.historyId;
  } catch (error) {
    // History ID may have expired (Gmail keeps history for ~7 days)
    console.warn(
      `[PollNewEmailsJob] History lookup failed for ${connection.email}, resetting baseline:`,
      error,
    );
    try {
      const listResult = await driver.list({ folder: 'inbox', maxResults: 1 });
      const latestThread = listResult.threads[0];
      if (latestThread?.historyId) {
        await deps.setHistoryId(connection.id, latestThread.historyId);
      }
    } catch (listError) {
      console.error(`[PollNewEmailsJob] Failed to reset baseline for ${connection.email}:`, listError);
    }
    return 0;
  }

  if (!history || history.length === 0) {
    // No changes since last poll
    if (newHistoryId && newHistoryId !== lastHistoryId) {
      await deps.setHistoryId(connection.id, newHistoryId);
    }
    return 0;
  }

  // Extract new thread IDs from history (skip drafts)
  const newThreadIds = new Set<string>();
  for (const item of history) {
    for (const msg of item.messagesAdded || []) {
      if (msg.message?.threadId && !msg.message?.labelIds?.includes('DRAFT')) {
        newThreadIds.add(msg.message.threadId);
      }
    }
  }

  if (newThreadIds.size === 0) {
    // No new messages (could be label changes only)
    if (newHistoryId) {
      await deps.setHistoryId(connection.id, newHistoryId);
    }
    return 0;
  }

  console.log(
    `[PollNewEmailsJob] Found ${newThreadIds.size} new threads for ${connection.email}`,
  );

  // Sync and evaluate triggers for each new thread
  let processedCount = 0;
  for (const threadId of newThreadIds) {
    try {
      const threadData = await deps.syncThread(connection.id, threadId);
      if (threadData) {
        await deps.evaluateTriggers(connection.id, {
          id: threadId,
          subject: threadData.subject,
          sender: threadData.sender,
          labels: threadData.tags,
          receivedOn: threadData.receivedOn,
          unread: threadData.unread,
          body: threadData.body,
        });
        processedCount++;
      }
    } catch (error) {
      console.error(`[PollNewEmailsJob] Failed to process thread ${threadId}:`, error);
    }
  }

  // Invalidate INBOX cache so next load reflects new emails
  if (processedCount > 0) {
    await deps.invalidateInboxCache(connection.id);
  }

  // Update history ID for next poll
  if (newHistoryId) {
    await deps.setHistoryId(connection.id, newHistoryId);
  }

  return processedCount;
}
