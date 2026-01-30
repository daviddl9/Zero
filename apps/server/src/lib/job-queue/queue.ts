/**
 * BullMQ Queue initialization
 *
 * Provides queue instances connected to Valkey/Redis for job processing.
 * This replaces Cloudflare Queues functionality for self-hosted deployments.
 */

import { Queue, QueueEvents } from 'bullmq';
import type { Redis as IORedis } from 'ioredis';
import { DEFAULT_JOB_OPTIONS, JOB_NAMES, type JobName, type JobOptions } from './jobs/types';

let redisConnection: IORedis | null = null;
let queues: Map<string, Queue> = new Map();
let queueEvents: Map<string, QueueEvents> = new Map();

export interface QueueConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number | null;
  enableReadyCheck?: boolean;
}

/**
 * Parse Redis URL into connection config
 * Supports both redis:// and http:// (Upstash proxy) URLs
 */
export function parseRedisUrl(url: string): QueueConfig {
  // Handle Upstash HTTP proxy URL format
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '80', 10),
      password: undefined, // Upstash uses token-based auth via headers
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }

  // Standard Redis URL format
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) : 0,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

/**
 * Initialize the Redis connection for BullMQ
 * Uses ioredis for native Redis protocol (required by BullMQ)
 */
export async function initializeRedisConnection(config: QueueConfig): Promise<IORedis> {
  if (redisConnection) {
    return redisConnection;
  }

  // Dynamic import to avoid issues in Cloudflare Workers environment
  const { Redis } = await import('ioredis');

  redisConnection = new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db,
    maxRetriesPerRequest: config.maxRetriesPerRequest ?? null,
    enableReadyCheck: config.enableReadyCheck ?? false,
    retryStrategy: (times: number) => {
      if (times > 10) {
        console.error('[BullMQ] Redis connection failed after 10 retries');
        return null;
      }
      return Math.min(times * 200, 5000);
    },
  });

  redisConnection.on('error', (err) => {
    console.error('[BullMQ] Redis connection error:', err.message);
  });

  redisConnection.on('connect', () => {
    console.log('[BullMQ] Redis connected');
  });

  return redisConnection;
}

/**
 * Get or create a queue by name
 */
export function getQueue<T = unknown>(name: JobName | string): Queue<T> {
  if (!redisConnection) {
    throw new Error('[BullMQ] Redis connection not initialized. Call initializeRedisConnection first.');
  }

  const existing = queues.get(name);
  if (existing) {
    return existing as Queue<T>;
  }

  const queue = new Queue<T>(name, {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
  });

  queues.set(name, queue);
  return queue;
}

/**
 * Get queue events for monitoring job progress
 */
export function getQueueEvents(name: JobName | string): QueueEvents {
  if (!redisConnection) {
    throw new Error('[BullMQ] Redis connection not initialized. Call initializeRedisConnection first.');
  }

  const existing = queueEvents.get(name);
  if (existing) {
    return existing;
  }

  const events = new QueueEvents(name, {
    connection: redisConnection.duplicate(),
  });

  queueEvents.set(name, events);
  return events;
}

/**
 * Add a job to a queue with type-safe data
 */
export async function addJob<T>(
  queueName: JobName,
  data: T,
  options?: Partial<JobOptions>,
): Promise<string> {
  const queue = getQueue<T>(queueName);
  const defaultOptions = DEFAULT_JOB_OPTIONS[queueName] || {};
  const mergedOptions = { ...defaultOptions, ...options };

  const job = await queue.add(queueName, data, {
    attempts: mergedOptions.attempts,
    backoff: mergedOptions.backoff,
    delay: mergedOptions.delay,
    priority: mergedOptions.priority,
    removeOnComplete: mergedOptions.removeOnComplete,
    removeOnFail: mergedOptions.removeOnFail,
  });

  return job.id!;
}

/**
 * Add multiple jobs to a queue in bulk
 */
export async function addBulkJobs<T>(
  queueName: JobName,
  jobs: Array<{ data: T; options?: Partial<JobOptions> }>,
): Promise<string[]> {
  const queue = getQueue<T>(queueName);
  const defaultOptions = DEFAULT_JOB_OPTIONS[queueName] || {};

  const bulkJobs = jobs.map(({ data, options }) => {
    const mergedOptions = { ...defaultOptions, ...options };
    return {
      name: queueName,
      data,
      opts: {
        attempts: mergedOptions.attempts,
        backoff: mergedOptions.backoff,
        delay: mergedOptions.delay,
        priority: mergedOptions.priority,
        removeOnComplete: mergedOptions.removeOnComplete,
        removeOnFail: mergedOptions.removeOnFail,
      },
    };
  });

  const addedJobs = await queue.addBulk(bulkJobs);
  return addedJobs.map((job) => job.id!);
}

/**
 * Get all queue instances for bull-board
 */
export function getAllQueues(): Queue[] {
  return Array.from(queues.values());
}

/**
 * Initialize all default queues
 */
export function initializeDefaultQueues(): void {
  Object.values(JOB_NAMES).forEach((name) => {
    getQueue(name);
  });
}

/**
 * Gracefully close all queues and connections
 */
export async function closeAllQueues(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  for (const events of queueEvents.values()) {
    closePromises.push(events.close());
  }

  for (const queue of queues.values()) {
    closePromises.push(queue.close());
  }

  await Promise.all(closePromises);

  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }

  queues.clear();
  queueEvents.clear();

  console.log('[BullMQ] All queues closed');
}

/**
 * Check if queues are initialized
 */
export function isInitialized(): boolean {
  return redisConnection !== null;
}

/**
 * Get the Redis connection for direct access (e.g., for workers)
 */
export function getRedisConnection(): IORedis | null {
  return redisConnection;
}
