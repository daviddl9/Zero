/**
 * Self-Hosted Module
 *
 * Provides Cloudflare-compatible abstractions backed by PostgreSQL and Redis/Valkey.
 * This allows the same application code to run without Cloudflare Workers.
 */

// KV Store
export {
  RedisKVStore,
  KVStoreFactory,
  bulkDeleteRedisKeys,
  type KVPutOptions,
  type KVGetOptions,
  type KVListOptions,
  type KVListResult,
  type KVValueWithMetadata,
} from './kv-store';

// Durable Storage
export {
  DurableStorage,
  DurableStorageFactory,
  DURABLE_STORAGE_SCHEMA,
  type StorageOptions,
} from './durable-storage';

// Object Store (S3/MinIO)
export {
  S3ObjectStore,
  R2ObjectStoreWrapper,
  createObjectStore,
  parseS3Config,
  type ObjectStoreConfig,
  type ObjectStorePutOptions,
  type ObjectStoreResult,
  type IObjectStore,
} from './object-store';

// Native Redis (replaces Upstash proxy)
export {
  NativeRedisClient,
  NativeRedisRateLimiter,
  createNativeRedisClient,
  createNativeRateLimiter,
  shouldUseNativeRedis,
  type NativeRedisConfig,
  type SetOptions,
  type RateLimiterConfig,
  type RateLimitResult,
} from './redis-native';

/**
 * Environment configuration for self-hosted mode
 */
export interface SelfHostedConfig {
  /** PostgreSQL connection string */
  databaseUrl: string;
  /** Redis/Valkey host */
  redisHost: string;
  /** Redis/Valkey port */
  redisPort: number;
  /** Redis/Valkey password (optional) */
  redisPassword?: string;
  /** HTTP server port */
  port: number;
  /** Enable BullMQ job queue */
  enableJobQueue: boolean;
  /** Enable BullMQ scheduler */
  enableScheduler: boolean;
  /** Number of worker threads */
  workerConcurrency: number;
}

/**
 * Parse environment variables into config
 */
export function parseConfig(): SelfHostedConfig {
  return {
    databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/zerodotemail',
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
    redisPassword: process.env.REDIS_PASSWORD,
    port: parseInt(process.env.PORT || '8787', 10),
    enableJobQueue: process.env.ENABLE_JOB_QUEUE !== 'false',
    enableScheduler: process.env.ENABLE_SCHEDULER !== 'false',
    workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '2', 10),
  };
}

/**
 * Check if running in self-hosted mode
 */
export function isSelfHostedMode(): boolean {
  return process.env.SELF_HOSTED === 'true' || process.env.STANDALONE === 'true';
}
