/**
 * Sync Threads Job
 *
 * BullMQ job that handles syncing Gmail threads for a connection.
 * This replaces the SyncThreadsWorkflow Cloudflare Workflow.
 */

import type { Job } from 'bullmq';
import type { SyncThreadsJobData, SyncThreadsResult } from './types';

/**
 * Process a sync threads job
 *
 * This function will be called by the worker when processing jobs.
 * The actual implementation depends on the database and driver being available,
 * which requires the standalone server context.
 */
export async function processSyncThreadsJob(
  job: Job<SyncThreadsJobData>,
): Promise<SyncThreadsResult> {
  const { userId, connectionId, pageToken, fullSync, maxResults = 20 } = job.data;

  console.log(`[SyncThreadsJob] Starting sync for connection ${connectionId}`);

  const result: SyncThreadsResult = {
    syncedThreads: 0,
    hasMore: false,
    errors: [],
  };

  try {
    // The actual sync logic will be implemented in the standalone server
    // where we have access to the database and email drivers
    //
    // This job acts as a task definition - the processor is registered
    // in the standalone server where all dependencies are available.

    job.updateProgress(10);
    console.log(`[SyncThreadsJob] Job ${job.id} parameters:`, {
      userId,
      connectionId,
      pageToken,
      fullSync,
      maxResults,
    });

    // Placeholder - actual implementation in standalone server
    // will import this and provide the real processor

    job.updateProgress(100);
    console.log(`[SyncThreadsJob] Completed sync for connection ${connectionId}`);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SyncThreadsJob] Failed to sync connection ${connectionId}:`, errorMessage);
    result.errors = [errorMessage];
    throw error;
  }
}

/**
 * Create the sync threads job processor with dependencies injected
 *
 * This factory function allows the standalone server to inject
 * the database, drivers, and other dependencies needed for processing.
 */
export function createSyncThreadsProcessor(deps: {
  getConnection: (connectionId: string) => Promise<{
    id: string;
    userId: string;
    providerId: string;
    email: string;
    accessToken: string;
    refreshToken: string;
  } | null>;
  getDriver: (connection: unknown) => {
    list: (params: { folder: string; maxResults: number; pageToken?: string }) => Promise<{
      threads: Array<{ id: string; historyId: string | null }>;
      nextPageToken: string | null;
    }>;
  } | null;
  syncThread: (connectionId: string, threadId: string) => Promise<{
    sender: string;
    receivedOn: string;
    subject: string;
    tags: Array<{ id: string; name?: string }>;
    unread: boolean;
    body?: string;
    decodedBody?: string;
  } | null>;
  storeThread: (
    connectionId: string,
    thread: {
      id: string;
      threadId: string;
      providerId: string;
      latestSender: string;
      latestReceivedOn: string;
      latestSubject: string;
    },
    labelIds: string[],
  ) => Promise<void>;
  evaluateTriggers: (
    connectionId: string,
    threadData: {
      id: string;
      subject: string;
      sender: string;
      labels: Array<{ id: string; name: string }>;
      receivedOn: string;
      unread: boolean;
      body: string;
    },
  ) => Promise<void>;
  reloadFolder: (connectionId: string, folder: string) => Promise<void>;
}) {
  return async (job: Job<SyncThreadsJobData>): Promise<SyncThreadsResult> => {
    const { connectionId, pageToken, maxResults = 20 } = job.data;

    console.log(`[SyncThreadsJob] Processing sync for connection ${connectionId}`);

    const result: SyncThreadsResult = {
      syncedThreads: 0,
      hasMore: false,
      errors: [],
    };

    try {
      // Get connection
      const connection = await deps.getConnection(connectionId);
      if (!connection) {
        throw new Error(`Connection ${connectionId} not found`);
      }

      job.updateProgress(10);

      // Get driver
      const driver = deps.getDriver(connection);
      if (!driver) {
        throw new Error(`No driver available for connection ${connectionId}`);
      }

      job.updateProgress(20);

      // List threads
      const listResult = await driver.list({
        folder: 'inbox',
        maxResults,
        pageToken: pageToken || undefined,
      });

      result.hasMore = !!listResult.nextPageToken;
      result.nextPageToken = listResult.nextPageToken || undefined;

      job.updateProgress(40);

      // Sync each thread
      const syncPromises = listResult.threads.map(async (thread, index) => {
        try {
          const latest = await deps.syncThread(connectionId, thread.id);

          if (latest) {
            const normalizedReceivedOn = new Date(latest.receivedOn).toISOString();

            await deps.storeThread(
              connectionId,
              {
                id: thread.id,
                threadId: thread.id,
                providerId: 'google',
                latestSender: latest.sender,
                latestReceivedOn: normalizedReceivedOn,
                latestSubject: latest.subject,
              },
              latest.tags.map((tag) => tag.id),
            );

            // Evaluate workflow triggers (fire and forget)
            deps
              .evaluateTriggers(connectionId, {
                id: thread.id,
                subject: latest.subject,
                sender: latest.sender,
                labels: latest.tags.map((tag) => ({
                  id: tag.id,
                  name: tag.name || tag.id,
                })),
                receivedOn: normalizedReceivedOn,
                unread: latest.unread,
                body: latest.body || latest.decodedBody || '',
              })
              .catch((err) => {
                console.warn(
                  `[SyncThreadsJob] Workflow trigger evaluation failed for ${thread.id}:`,
                  err,
                );
              });

            result.syncedThreads++;
            console.log(`[SyncThreadsJob] Synced thread ${thread.id}`);
          }

          // Update progress
          const progress = 40 + Math.floor((index / listResult.threads.length) * 50);
          job.updateProgress(progress);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[SyncThreadsJob] Failed to sync thread ${thread.id}:`, errorMessage);
          result.errors?.push(`Thread ${thread.id}: ${errorMessage}`);
        }
      });

      await Promise.allSettled(syncPromises);

      job.updateProgress(95);

      // Reload folder
      await deps.reloadFolder(connectionId, 'inbox');

      job.updateProgress(100);

      console.log(
        `[SyncThreadsJob] Completed sync for ${connectionId}: ${result.syncedThreads} threads synced`,
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[SyncThreadsJob] Job failed:`, errorMessage);
      result.errors = [errorMessage];
      throw error;
    }
  };
}
