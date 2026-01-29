/**
 * Sync Coordinator Job
 *
 * BullMQ job that coordinates multi-page thread syncs.
 * This handles the orchestration of paginated sync operations.
 */

import type { Job } from 'bullmq';
import { addJob } from '../queue';
import { JOB_NAMES, type SyncCoordinatorJobData, type SyncCoordinatorResult, type SyncThreadsJobData } from './types';

/**
 * Process a sync coordinator job
 *
 * The coordinator is responsible for:
 * 1. Determining the sync strategy (full sync vs history sync)
 * 2. Managing pagination by spawning child sync jobs
 * 3. Tracking overall progress
 */
export async function processSyncCoordinatorJob(
  job: Job<SyncCoordinatorJobData>,
): Promise<SyncCoordinatorResult> {
  const { userId, connectionId, triggerType: _triggerType, historyId } = job.data;

  console.log(`[SyncCoordinatorJob] Starting coordination for connection ${connectionId}`);
  console.log(`[SyncCoordinatorJob] Trigger type: ${triggerType}, historyId: ${historyId}`);

  const result: SyncCoordinatorResult = {
    totalPages: 0,
    totalThreads: 0,
    completedAt: new Date().toISOString(),
  };

  try {
    job.updateProgress(10);

    // For now, spawn a single sync job
    // In a full implementation, this would handle pagination
    const syncJobId = await addJob<SyncThreadsJobData>(JOB_NAMES.SYNC_THREADS, {
      userId,
      connectionId,
      historyId,
      fullSync: triggerType === 'full_sync',
      maxResults: 20,
    });

    console.log(`[SyncCoordinatorJob] Spawned sync job ${syncJobId}`);
    result.totalPages = 1;

    job.updateProgress(100);
    result.completedAt = new Date().toISOString();

    console.log(`[SyncCoordinatorJob] Coordination complete for ${connectionId}`);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SyncCoordinatorJob] Failed to coordinate sync:`, errorMessage);
    throw error;
  }
}

/**
 * Create the sync coordinator processor with dependencies injected
 */
export function createSyncCoordinatorProcessor(deps: {
  getHistoryId: (connectionId: string) => Promise<string | null>;
  setHistoryId: (connectionId: string, historyId: string) => Promise<void>;
  acquireLock: (key: string, ttlSeconds: number) => Promise<boolean>;
  releaseLock: (key: string) => Promise<void>;
  listHistory: (connectionId: string, historyId: string) => Promise<{
    history: Array<{
      messagesAdded?: Array<{ message?: { threadId?: string; labelIds?: string[] } }>;
      labelsAdded?: Array<{ message?: { threadId?: string }; labelIds?: string[] }>;
      labelsRemoved?: Array<{ message?: { threadId?: string }; labelIds?: string[] }>;
    }>;
  }>;
  syncThread: (connectionId: string, threadId: string) => Promise<{ success: boolean }>;
  modifyLabels: (
    connectionId: string,
    threadId: string,
    addLabels: string[],
    removeLabels: string[],
  ) => Promise<void>;
  reloadFolder: (connectionId: string, folder: string) => Promise<void>;
}) {
  return async (job: Job<SyncCoordinatorJobData>): Promise<SyncCoordinatorResult> => {
    const { connectionId, triggerType: _triggerType, historyId } = job.data;

    console.log(`[SyncCoordinatorJob] Processing for connection ${connectionId}`);

    const result: SyncCoordinatorResult = {
      totalPages: 0,
      totalThreads: 0,
      completedAt: new Date().toISOString(),
    };

    // Get current history ID or use provided one
    const currentHistoryId = historyId || (await deps.getHistoryId(connectionId));
    if (!currentHistoryId) {
      console.log(`[SyncCoordinatorJob] No history ID available, triggering full sync`);
      // Queue a full sync job
      await addJob<SyncThreadsJobData>(JOB_NAMES.SYNC_THREADS, {
        userId: job.data.userId,
        connectionId,
        fullSync: true,
        maxResults: 20,
      });
      result.totalPages = 1;
      return result;
    }

    // Acquire lock for this history processing
    const lockKey = `history_${connectionId}__${currentHistoryId}`;
    const lockAcquired = await deps.acquireLock(lockKey, 3600);

    if (!lockAcquired) {
      console.log(`[SyncCoordinatorJob] History already being processed: ${lockKey}`);
      return result;
    }

    try {
      job.updateProgress(10);

      // Get history changes
      const { history } = await deps.listHistory(connectionId, currentHistoryId);

      if (!history || history.length === 0) {
        console.log(`[SyncCoordinatorJob] No history changes found`);
        return result;
      }

      job.updateProgress(20);

      // Extract thread IDs and label changes
      const threadsAdded = new Set<string>();
      const threadLabelChanges = new Map<
        string,
        { addLabels: Set<string>; removeLabels: Set<string> }
      >();

      for (const historyItem of history) {
        // Extract new threads
        for (const msg of historyItem.messagesAdded || []) {
          if (msg.message?.labelIds?.includes('DRAFT')) continue;
          if (msg.message?.threadId) {
            threadsAdded.add(msg.message.threadId);
          }
        }

        // Track label additions
        for (const labelChange of historyItem.labelsAdded || []) {
          const threadId = labelChange.message?.threadId;
          if (!threadId || !labelChange.labelIds?.length) continue;

          let changes = threadLabelChanges.get(threadId);
          if (!changes) {
            changes = { addLabels: new Set(), removeLabels: new Set() };
            threadLabelChanges.set(threadId, changes);
          }
          labelChange.labelIds.forEach((id) => changes!.addLabels.add(id));
        }

        // Track label removals
        for (const labelChange of historyItem.labelsRemoved || []) {
          const threadId = labelChange.message?.threadId;
          if (!threadId || !labelChange.labelIds?.length) continue;

          let changes = threadLabelChanges.get(threadId);
          if (!changes) {
            changes = { addLabels: new Set(), removeLabels: new Set() };
            threadLabelChanges.set(threadId, changes);
          }
          labelChange.labelIds.forEach((id) => changes!.removeLabels.add(id));
        }
      }

      job.updateProgress(40);

      // Sync new threads
      if (threadsAdded.size > 0) {
        console.log(`[SyncCoordinatorJob] Syncing ${threadsAdded.size} new threads`);

        const syncPromises = Array.from(threadsAdded).map(async (threadId) => {
          try {
            await deps.syncThread(connectionId, threadId);
            result.totalThreads++;
          } catch (error) {
            console.error(`[SyncCoordinatorJob] Failed to sync thread ${threadId}:`, error);
          }
        });

        await Promise.allSettled(syncPromises);
        result.totalPages++;
      }

      job.updateProgress(70);

      // Process label changes
      if (threadLabelChanges.size > 0) {
        console.log(`[SyncCoordinatorJob] Processing label changes for ${threadLabelChanges.size} threads`);

        for (const [threadId, changes] of threadLabelChanges) {
          const addLabels = Array.from(changes.addLabels);
          const removeLabels = Array.from(changes.removeLabels);

          if (addLabels.length > 0 || removeLabels.length > 0) {
            try {
              await deps.modifyLabels(connectionId, threadId, addLabels, removeLabels);
            } catch (error) {
              console.error(`[SyncCoordinatorJob] Failed to modify labels for ${threadId}:`, error);
            }
          }
        }
      }

      job.updateProgress(90);

      // Reload inbox
      await deps.reloadFolder(connectionId, 'inbox');

      job.updateProgress(100);
      result.completedAt = new Date().toISOString();

      console.log(`[SyncCoordinatorJob] Coordination complete: ${result.totalThreads} threads synced`);
      return result;
    } finally {
      // Always release the lock
      await deps.releaseLock(lockKey);
    }
  };
}
