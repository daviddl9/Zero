/**
 * Job Queue Module
 *
 * BullMQ-based job queue infrastructure for self-hosted deployments.
 * Replaces Cloudflare Workflows, Queues, and cron triggers.
 *
 * Usage:
 *   import { initializeJobQueue, addJob, JOB_NAMES } from './lib/job-queue';
 *
 *   // Initialize on server startup
 *   await initializeJobQueue({ host: 'localhost', port: 6379 });
 *
 *   // Add a job
 *   await addJob(JOB_NAMES.SYNC_THREADS, { userId: '...', connectionId: '...' });
 */

// Queue management
export {
  initializeRedisConnection,
  parseRedisUrl,
  getQueue,
  getQueueEvents,
  addJob,
  addBulkJobs,
  getAllQueues,
  initializeDefaultQueues,
  closeAllQueues,
  isInitialized,
  getRedisConnection,
  type QueueConfig,
} from './queue';

// Worker management
export {
  registerProcessor,
  createWorker,
  createUnifiedWorker,
  getWorker,
  getAllWorkers,
  pauseWorker,
  resumeWorker,
  closeAllWorkers,
  hasActiveWorkers,
  getWorkerStats,
  type WorkerConfig,
} from './worker';

// Scheduler for cron jobs
export {
  initializeScheduler,
  scheduleJob,
  removeScheduledJob,
  listScheduledJobs,
  scheduleSubscriptionRenewal,
  cancelSubscriptionRenewal,
  getSchedulerStats,
  stopScheduler,
  type ScheduledJobConfig,
} from './scheduler';

// Job types and constants
export {
  JOB_NAMES,
  DEFAULT_JOB_OPTIONS,
  type JobName,
  type JobData,
  type JobOptions,
  type SyncThreadsJobData,
  type SyncCoordinatorJobData,
  type SendEmailJobData,
  type SubscriptionRenewalJobData,
  type ProcessScheduledEmailsJobData,
  type CleanupWorkflowExecutionsJobData,
  type ThreadWorkflowJobData,
  type SyncThreadsResult,
  type SyncCoordinatorResult,
  type SendEmailResult,
  type SubscriptionRenewalResult,
} from './jobs/types';

/**
 * Initialize the complete job queue system
 *
 * This sets up:
 * 1. Redis connection for BullMQ
 * 2. All default queues
 * 3. Scheduled/repeatable jobs
 *
 * Call this once on server startup for self-hosted mode.
 */
export async function initializeJobQueue(config: {
  redisUrl?: string;
  redisHost?: string;
  redisPort?: number;
  redisPassword?: string;
  startWorkers?: boolean;
  startScheduler?: boolean;
}): Promise<void> {
  const {
    parseRedisUrl,
    initializeRedisConnection,
    initializeDefaultQueues,
  } = await import('./queue');
  const { initializeScheduler } = await import('./scheduler');

  // Parse config
  let queueConfig;
  if (config.redisUrl) {
    queueConfig = parseRedisUrl(config.redisUrl);
  } else {
    queueConfig = {
      host: config.redisHost || 'localhost',
      port: config.redisPort || 6379,
      password: config.redisPassword,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }

  console.log('[JobQueue] Initializing with Redis at', `${queueConfig.host}:${queueConfig.port}`);

  // Initialize Redis connection
  await initializeRedisConnection(queueConfig);

  // Initialize all queues
  initializeDefaultQueues();

  // Start scheduler if requested
  if (config.startScheduler !== false) {
    await initializeScheduler();
  }

  console.log('[JobQueue] Initialization complete');
}

/**
 * Shutdown the job queue system gracefully
 */
export async function shutdownJobQueue(): Promise<void> {
  const { closeAllWorkers } = await import('./worker');
  const { stopScheduler } = await import('./scheduler');
  const { closeAllQueues } = await import('./queue');

  console.log('[JobQueue] Shutting down...');

  // Stop scheduler first
  await stopScheduler();

  // Close workers
  await closeAllWorkers();

  // Close queues and Redis connection
  await closeAllQueues();

  console.log('[JobQueue] Shutdown complete');
}
