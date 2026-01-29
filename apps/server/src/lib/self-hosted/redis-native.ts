/**
 * Native Redis Client - ioredis-based Redis client
 *
 * Provides a native Redis client for self-hosted deployments that replaces
 * Upstash Redis HTTP proxy. This enables direct TCP connections to Redis/Valkey
 * for better performance and reduced complexity.
 *
 * Used for:
 * - Session cache in auth.ts
 * - Rate limiting in trpc.ts
 */

import Redis from 'ioredis';

/**
 * Configuration for native Redis client
 */
export interface NativeRedisConfig {
  /** Redis host */
  host: string;
  /** Redis port */
  port: number;
  /** Redis password (optional) */
  password?: string;
  /** Key prefix for namespacing */
  keyPrefix?: string;
}

/**
 * Options for set operations
 */
export interface SetOptions {
  /** Expiration in seconds */
  ex?: number;
  /** Expiration in milliseconds */
  px?: number;
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum number of requests allowed */
  points: number;
  /** Time window in seconds */
  duration: number;
  /** Key prefix for rate limit keys */
  keyPrefix: string;
}

/**
 * Rate limiter result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean;
  /** Maximum number of requests allowed */
  limit: number;
  /** Number of remaining requests */
  remaining: number;
  /** Unix timestamp (ms) when the rate limit resets */
  reset: number;
}

/**
 * Native Redis client that provides Upstash-compatible interface
 * for session cache operations
 */
export class NativeRedisClient {
  private redis: Redis;

  constructor(config: NativeRedisConfig) {
    this.redis = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      keyPrefix: config.keyPrefix,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => {
        if (times > 10) {
          console.error('[NativeRedis] Connection failed after 10 retries');
          return null;
        }
        return Math.min(times * 200, 5000);
      },
    });

    this.redis.on('error', (err) => {
      console.error('[NativeRedis] Error:', err.message);
    });

    this.redis.on('connect', () => {
      console.log('[NativeRedis] Connected');
    });
  }

  /**
   * Get a value by key
   */
  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  /**
   * Set a value with optional expiration
   */
  async set(key: string, value: string, options?: SetOptions): Promise<void> {
    if (options?.ex) {
      await this.redis.set(key, value, 'EX', options.ex);
    } else if (options?.px) {
      await this.redis.set(key, value, 'PX', options.px);
    } else {
      await this.redis.set(key, value);
    }
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Get the underlying ioredis client
   * (for use with rate-limiter-flexible or other libs)
   */
  getClient(): Redis {
    return this.redis;
  }

  /**
   * Close the connection
   */
  async quit(): Promise<void> {
    await this.redis.quit();
  }
}

/**
 * Native Redis rate limiter using sliding window algorithm
 * Replaces @upstash/ratelimit for self-hosted deployments
 */
export class NativeRedisRateLimiter {
  private redis: Redis;
  private config: RateLimiterConfig;

  constructor(redis: Redis, config: RateLimiterConfig) {
    this.redis = redis;
    this.config = config;
  }

  /**
   * Check and consume rate limit for a given identifier
   */
  async limit(identifier: string): Promise<RateLimitResult> {
    const key = `${this.config.keyPrefix}${identifier}`;
    const now = Date.now();

    // Use MULTI/EXEC for atomic increment and TTL check
    const multi = this.redis.multi();
    multi.incr(key);
    multi.expire(key, this.config.duration);

    const results = await multi.exec();

    if (!results) {
      // Redis transaction failed, allow the request
      return {
        success: true,
        limit: this.config.points,
        remaining: this.config.points - 1,
        reset: now + this.config.duration * 1000,
      };
    }

    const currentCount = results[0]?.[1] as number;
    const ttl = await this.redis.ttl(key);

    const remaining = Math.max(0, this.config.points - currentCount);
    const success = currentCount <= this.config.points;
    const reset = now + (ttl > 0 ? ttl * 1000 : this.config.duration * 1000);

    return {
      success,
      limit: this.config.points,
      remaining,
      reset,
    };
  }
}

/**
 * Create a native Redis client from config or environment variables
 */
export function createNativeRedisClient(config?: NativeRedisConfig): NativeRedisClient {
  const finalConfig: NativeRedisConfig = config || {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  };

  return new NativeRedisClient(finalConfig);
}

/**
 * Create a rate limiter compatible with the Upstash Ratelimit interface
 * for use in trpc.ts
 */
export function createNativeRateLimiter(
  redis: Redis,
  config: RateLimiterConfig,
): NativeRedisRateLimiter {
  return new NativeRedisRateLimiter(redis, config);
}

/**
 * Check if we should use native Redis (self-hosted mode)
 */
export function shouldUseNativeRedis(): boolean {
  return process.env.SELF_HOSTED === 'true' || process.env.STANDALONE === 'true';
}
