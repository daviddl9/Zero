/**
 * BullMQ Scheduler for repeatable jobs
 *
 * Replaces Cloudflare cron triggers with BullMQ's built-in
 * repeatable job functionality.
 */

import { getQueue } from './queue';
import {
  JOB_NAMES,
  type ProcessScheduledEmailsJobData,
  type CleanupWorkflowExecutionsJobData,
  type SubscriptionRenewalJobData,
} from './jobs/types';

export interface ScheduledJobConfig {
  name: string;
  pattern: string; // Cron pattern
  data: Record<string, unknown>;
  options?: {
    timezone?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  };
}

/**
 * Default scheduled jobs that replace Cloudflare cron triggers
 *
 * Current Cloudflare cron schedule (from main.ts):
 * - Every minute: processScheduledEmails, processExpiredSubscriptions, cleanupOldWorkflowExecutions
 */
const DEFAULT_SCHEDULED_JOBS: ScheduledJobConfig[] = [
  {
    name: JOB_NAMES.PROCESS_SCHEDULED_EMAILS,
    pattern: '* * * * *', // Every minute
    data: {
      batchSize: 50,
      windowHours: 12,
    } satisfies ProcessScheduledEmailsJobData,
  },
  {
    name: JOB_NAMES.CLEANUP_WORKFLOW_EXECUTIONS,
    pattern: '0 * * * *', // Every hour (less frequent than CF, more appropriate)
    data: {
      retentionDays: 30,
    } satisfies CleanupWorkflowExecutionsJobData,
  },
];

/**
 * Initialize all scheduled jobs
 */
export async function initializeScheduler(): Promise<void> {
  console.log('[Scheduler] Initializing scheduled jobs...');

  for (const jobConfig of DEFAULT_SCHEDULED_JOBS) {
    await scheduleJob(jobConfig);
  }

  console.log(`[Scheduler] Initialized ${DEFAULT_SCHEDULED_JOBS.length} scheduled jobs`);
}

/**
 * Schedule a repeatable job
 */
export async function scheduleJob(config: ScheduledJobConfig): Promise<void> {
  const queue = getQueue(config.name);

  // Remove any existing repeatable job with the same key
  const existingJobs = await queue.getRepeatableJobs();
  for (const job of existingJobs) {
    if (job.name === config.name) {
      await queue.removeRepeatableByKey(job.key);
      console.log(`[Scheduler] Removed existing scheduled job: ${config.name}`);
    }
  }

  // Add the new repeatable job
  await queue.add(config.name, config.data, {
    repeat: {
      pattern: config.pattern,
      tz: config.options?.timezone,
      startDate: config.options?.startDate,
      endDate: config.options?.endDate,
      limit: config.options?.limit,
    },
    removeOnComplete: 10,
    removeOnFail: 5,
  });

  console.log(`[Scheduler] Scheduled job ${config.name} with pattern: ${config.pattern}`);
}

/**
 * Remove a scheduled job
 */
export async function removeScheduledJob(name: string): Promise<boolean> {
  const queue = getQueue(name);
  const existingJobs = await queue.getRepeatableJobs();

  let removed = false;
  for (const job of existingJobs) {
    if (job.name === name) {
      await queue.removeRepeatableByKey(job.key);
      removed = true;
      console.log(`[Scheduler] Removed scheduled job: ${name}`);
    }
  }

  return removed;
}

/**
 * List all scheduled jobs
 */
export async function listScheduledJobs(): Promise<
  Array<{
    name: string;
    pattern: string;
    next: Date | null;
    timezone?: string;
  }>
> {
  const allJobs: Array<{
    name: string;
    pattern: string;
    next: Date | null;
    timezone?: string;
  }> = [];

  for (const jobName of Object.values(JOB_NAMES)) {
    try {
      const queue = getQueue(jobName);
      const repeatableJobs = await queue.getRepeatableJobs();

      for (const job of repeatableJobs) {
        allJobs.push({
          name: job.name || jobName,
          pattern: job.pattern || '',
          next: job.next ? new Date(job.next) : null,
          timezone: job.tz,
        });
      }
    } catch {
      // Queue might not exist, skip
    }
  }

  return allJobs;
}

/**
 * Schedule subscription renewal for a specific connection
 * This is called dynamically when subscriptions need renewal
 */
export async function scheduleSubscriptionRenewal(
  userId: string,
  connectionId: string,
  email: string,
  delayMs: number = 0,
): Promise<string> {
  const queue = getQueue<SubscriptionRenewalJobData>(JOB_NAMES.SUBSCRIPTION_RENEWAL);

  const job = await queue.add(
    JOB_NAMES.SUBSCRIPTION_RENEWAL,
    {
      userId,
      connectionId,
      email,
    },
    {
      delay: delayMs,
      removeOnComplete: 50,
      removeOnFail: 20,
      jobId: `renewal-${connectionId}`, // Dedupe by connection
    },
  );

  console.log(
    `[Scheduler] Scheduled subscription renewal for ${email} (delay: ${delayMs}ms)`,
  );

  return job.id!;
}

/**
 * Cancel a pending subscription renewal
 */
export async function cancelSubscriptionRenewal(connectionId: string): Promise<boolean> {
  const queue = getQueue(JOB_NAMES.SUBSCRIPTION_RENEWAL);

  try {
    const job = await queue.getJob(`renewal-${connectionId}`);
    if (job) {
      await job.remove();
      console.log(`[Scheduler] Cancelled subscription renewal for connection ${connectionId}`);
      return true;
    }
  } catch (err) {
    console.warn(`[Scheduler] Failed to cancel renewal for ${connectionId}:`, err);
  }

  return false;
}

/**
 * Get scheduler statistics
 */
export async function getSchedulerStats(): Promise<{
  totalScheduledJobs: number;
  jobsByQueue: Record<string, number>;
}> {
  const jobsByQueue: Record<string, number> = {};
  let total = 0;

  for (const jobName of Object.values(JOB_NAMES)) {
    try {
      const queue = getQueue(jobName);
      const repeatableJobs = await queue.getRepeatableJobs();
      jobsByQueue[jobName] = repeatableJobs.length;
      total += repeatableJobs.length;
    } catch {
      jobsByQueue[jobName] = 0;
    }
  }

  return {
    totalScheduledJobs: total,
    jobsByQueue,
  };
}

/**
 * Stop the scheduler (remove all repeatable jobs)
 */
export async function stopScheduler(): Promise<void> {
  console.log('[Scheduler] Stopping all scheduled jobs...');

  for (const jobName of Object.values(JOB_NAMES)) {
    try {
      const queue = getQueue(jobName);
      const repeatableJobs = await queue.getRepeatableJobs();

      for (const job of repeatableJobs) {
        await queue.removeRepeatableByKey(job.key);
      }
    } catch {
      // Queue might not exist, skip
    }
  }

  console.log('[Scheduler] All scheduled jobs stopped');
}
