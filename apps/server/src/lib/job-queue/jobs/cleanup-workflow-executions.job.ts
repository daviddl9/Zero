/**
 * Cleanup Workflow Executions Job
 *
 * BullMQ job for cleaning up old workflow execution records.
 * This replaces the Cloudflare cron trigger for workflow cleanup.
 */

import type { Job } from 'bullmq';
import type { CleanupWorkflowExecutionsJobData } from './types';

/**
 * Process cleanup workflow executions job
 */
export async function processCleanupWorkflowExecutionsJob(
  job: Job<CleanupWorkflowExecutionsJobData>,
): Promise<{ deleted: number }> {
  const { retentionDays = 30 } = job.data;

  console.log(`[CleanupWorkflowExecutionsJob] Cleaning executions older than ${retentionDays} days`);

  try {
    job.updateProgress(10);

    // Placeholder - actual implementation in standalone server
    const result = {
      deleted: 0,
    };

    job.updateProgress(100);
    console.log(`[CleanupWorkflowExecutionsJob] Deleted ${result.deleted} old executions`);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[CleanupWorkflowExecutionsJob] Failed:`, errorMessage);
    throw error;
  }
}

/**
 * Create the cleanup processor with dependencies injected
 */
export function createCleanupWorkflowExecutionsProcessor(deps: {
  deleteOldExecutions: (olderThan: Date) => Promise<number>;
}) {
  return async (
    job: Job<CleanupWorkflowExecutionsJobData>,
  ): Promise<{ deleted: number }> => {
    const { retentionDays = 30 } = job.data;

    console.log(`[CleanupWorkflowExecutionsJob] Starting cleanup (retention: ${retentionDays} days)`);

    try {
      job.updateProgress(10);

      // Calculate cutoff date
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      job.updateProgress(30);

      // Delete old executions
      const deleted = await deps.deleteOldExecutions(cutoffDate);

      job.updateProgress(100);

      console.log(`[CleanupWorkflowExecutionsJob] Deleted ${deleted} executions older than ${cutoffDate.toISOString()}`);

      return { deleted };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[CleanupWorkflowExecutionsJob] Failed:`, errorMessage);
      throw error;
    }
  };
}
