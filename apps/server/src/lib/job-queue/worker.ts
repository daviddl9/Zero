/**
 * BullMQ Worker implementation
 *
 * Provides worker instances that process jobs from queues.
 * Uses worker_threads for CPU-bound task isolation on Raspberry Pi.
 */

import { Worker, type Job, type Processor } from 'bullmq';
import { getRedisConnection } from './queue';
import {
  JOB_NAMES,
  type JobName,
  type SyncThreadsJobData,
  type SyncCoordinatorJobData,
  type SendEmailJobData,
  type SubscriptionRenewalJobData,
  type ProcessScheduledEmailsJobData,
  type CleanupWorkflowExecutionsJobData,
  type ThreadWorkflowJobData,
} from './jobs/types';

const workers: Map<string, Worker> = new Map();

export interface WorkerConfig {
  concurrency?: number;
  limiter?: {
    max: number;
    duration: number;
  };
  lockDuration?: number;
  stalledInterval?: number;
}

/**
 * Default worker configuration optimized for Raspberry Pi
 */
const DEFAULT_WORKER_CONFIG: WorkerConfig = {
  concurrency: 2, // Conservative for 4GB Pi
  lockDuration: 60000, // 1 minute lock
  stalledInterval: 30000, // Check for stalled jobs every 30s
};

/**
 * Job processor registry - maps job names to their processor functions
 */
type JobProcessor<T, R = void> = (job: Job<T>) => Promise<R>;

const jobProcessors: Map<JobName, JobProcessor<unknown>> = new Map();

/**
 * Register a job processor for a specific job type
 */
export function registerProcessor<T>(name: JobName, processor: JobProcessor<T>): void {
  jobProcessors.set(name, processor as JobProcessor<unknown>);
}

/**
 * Create and start a worker for a specific queue
 */
export function createWorker<T = unknown, R = unknown>(
  name: JobName | string,
  processor: Processor<T, R>,
  config: Partial<WorkerConfig> = {},
): Worker<T, R> {
  const connection = getRedisConnection();
  if (!connection) {
    throw new Error('[BullMQ] Redis connection not initialized');
  }

  const existing = workers.get(name);
  if (existing) {
    console.warn(`[BullMQ] Worker for ${name} already exists, returning existing worker`);
    return existing as Worker<T, R>;
  }

  const mergedConfig = { ...DEFAULT_WORKER_CONFIG, ...config };

  const worker = new Worker<T, R>(name, processor, {
    connection: connection.duplicate(),
    concurrency: mergedConfig.concurrency,
    limiter: mergedConfig.limiter,
    lockDuration: mergedConfig.lockDuration,
    stalledInterval: mergedConfig.stalledInterval,
  });

  // Event handlers for monitoring
  worker.on('completed', (job) => {
    console.log(`[BullMQ] Job ${job.id} completed in queue ${name}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[BullMQ] Job ${job?.id} failed in queue ${name}:`, err.message);
  });

  worker.on('error', (err) => {
    console.error(`[BullMQ] Worker error in queue ${name}:`, err.message);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[BullMQ] Job ${jobId} stalled in queue ${name}`);
  });

  workers.set(name, worker);
  console.log(`[BullMQ] Worker started for queue ${name} with concurrency ${mergedConfig.concurrency}`);

  return worker;
}

/**
 * Create a unified worker that handles all job types
 * This is more efficient for single-instance deployments like Raspberry Pi
 */
export function createUnifiedWorker(config: Partial<WorkerConfig> = {}): Worker[] {
  const connection = getRedisConnection();
  if (!connection) {
    throw new Error('[BullMQ] Redis connection not initialized');
  }

  const createdWorkers: Worker[] = [];

  // Create a worker for each job type
  for (const jobName of Object.values(JOB_NAMES)) {
    const processor = jobProcessors.get(jobName);
    if (!processor) {
      console.warn(`[BullMQ] No processor registered for ${jobName}, skipping worker creation`);
      continue;
    }

    const worker = createWorker(jobName, processor as Processor, config);
    createdWorkers.push(worker);
  }

  return createdWorkers;
}

/**
 * Get a worker by name
 */
export function getWorker(name: JobName | string): Worker | undefined {
  return workers.get(name);
}

/**
 * Get all workers
 */
export function getAllWorkers(): Worker[] {
  return Array.from(workers.values());
}

/**
 * Pause a worker
 */
export async function pauseWorker(name: JobName | string): Promise<void> {
  const worker = workers.get(name);
  if (worker) {
    await worker.pause();
    console.log(`[BullMQ] Worker ${name} paused`);
  }
}

/**
 * Resume a worker
 */
export async function resumeWorker(name: JobName | string): Promise<void> {
  const worker = workers.get(name);
  if (worker) {
    await worker.resume();
    console.log(`[BullMQ] Worker ${name} resumed`);
  }
}

/**
 * Gracefully close all workers
 */
export async function closeAllWorkers(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  for (const [name, worker] of workers) {
    console.log(`[BullMQ] Closing worker ${name}...`);
    closePromises.push(worker.close());
  }

  await Promise.all(closePromises);
  workers.clear();
  console.log('[BullMQ] All workers closed');
}

/**
 * Check if workers are running
 */
export function hasActiveWorkers(): boolean {
  return workers.size > 0;
}

/**
 * Get worker statistics
 */
export async function getWorkerStats(): Promise<
  Map<string, { isRunning: boolean; isPaused: boolean }>
> {
  const stats = new Map<string, { isRunning: boolean; isPaused: boolean }>();

  for (const [name, worker] of workers) {
    stats.set(name, {
      isRunning: worker.isRunning(),
      isPaused: worker.isPaused(),
    });
  }

  return stats;
}

// Re-export types for convenience
export type {
  SyncThreadsJobData,
  SyncCoordinatorJobData,
  SendEmailJobData,
  SubscriptionRenewalJobData,
  ProcessScheduledEmailsJobData,
  CleanupWorkflowExecutionsJobData,
  ThreadWorkflowJobData,
};
