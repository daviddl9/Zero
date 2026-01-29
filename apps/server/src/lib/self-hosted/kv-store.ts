/**
 * KV Store - Redis/Valkey-backed Key-Value Store
 *
 * Provides a Cloudflare KV-compatible interface backed by Redis/Valkey.
 * This replaces Cloudflare KV namespaces for self-hosted deployments.
 */

import type { Redis as IORedis } from 'ioredis';

/**
 * Options for KV put operations
 */
export interface KVPutOptions {
  /** Expiration time in seconds (TTL) */
  expirationTtl?: number;
  /** Absolute expiration timestamp (Unix epoch in seconds) */
  expiration?: number;
  /** Metadata to store with the value */
  metadata?: Record<string, unknown>;
}

/**
 * Options for KV get operations
 */
export interface KVGetOptions {
  /** Type of value to return */
  type?: 'text' | 'json' | 'arrayBuffer' | 'stream';
  /** Whether to cache the value locally */
  cacheTtl?: number;
}

/**
 * Options for KV list operations
 */
export interface KVListOptions {
  /** Prefix to filter keys */
  prefix?: string;
  /** Maximum number of keys to return */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
}

/**
 * Result of KV list operation
 */
export interface KVListResult {
  keys: Array<{
    name: string;
    expiration?: number;
    metadata?: Record<string, unknown>;
  }>;
  list_complete: boolean;
  cursor?: string;
}

/**
 * Result of KV get with metadata
 */
export interface KVValueWithMetadata<T> {
  value: T | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Redis-backed KV Store that implements the Cloudflare KV interface
 */
export class RedisKVStore {
  private redis: IORedis;
  private namespace: string;

  constructor(redis: IORedis, namespace: string) {
    this.redis = redis;
    this.namespace = namespace;
  }

  /**
   * Build the full Redis key with namespace prefix
   */
  private buildKey(key: string): string {
    return `kv:${this.namespace}:${key}`;
  }

  /**
   * Build the metadata key
   */
  private buildMetadataKey(key: string): string {
    return `kv:${this.namespace}:${key}:__metadata`;
  }

  /**
   * Get a value from the store
   */
  async get(key: string, options?: KVGetOptions): Promise<string | null>;
  async get(key: string, options: { type: 'json' }): Promise<unknown | null>;
  async get(key: string, options?: KVGetOptions): Promise<string | unknown | null> {
    const fullKey = this.buildKey(key);
    const value = await this.redis.get(fullKey);

    if (value === null) {
      return null;
    }

    if (options?.type === 'json') {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }

    return value;
  }

  /**
   * Get a value with its metadata
   */
  async getWithMetadata<T = string>(
    key: string,
    options?: KVGetOptions,
  ): Promise<KVValueWithMetadata<T>> {
    const fullKey = this.buildKey(key);
    const metadataKey = this.buildMetadataKey(key);

    const [value, metadataStr] = await Promise.all([
      this.redis.get(fullKey),
      this.redis.get(metadataKey),
    ]);

    let parsedValue: T | null = null;
    if (value !== null) {
      if (options?.type === 'json') {
        try {
          parsedValue = JSON.parse(value) as T;
        } catch {
          parsedValue = null;
        }
      } else {
        parsedValue = value as unknown as T;
      }
    }

    let metadata: Record<string, unknown> | null = null;
    if (metadataStr) {
      try {
        metadata = JSON.parse(metadataStr);
      } catch {
        metadata = null;
      }
    }

    return { value: parsedValue, metadata };
  }

  /**
   * Store a value in the store
   */
  async put(
    key: string,
    value: string | ArrayBuffer | ReadableStream,
    options?: KVPutOptions,
  ): Promise<void> {
    const fullKey = this.buildKey(key);

    // Convert value to string
    let stringValue: string;
    if (typeof value === 'string') {
      stringValue = value;
    } else if (value instanceof ArrayBuffer) {
      stringValue = Buffer.from(value).toString('base64');
    } else {
      // ReadableStream - collect all chunks
      const reader = value.getReader();
      const chunks: Uint8Array[] = [];
      let done = false;
      while (!done) {
        const result = await reader.read();
        done = result.done;
        if (result.value) {
          chunks.push(result.value);
        }
      }
      stringValue = Buffer.concat(chunks).toString('base64');
    }

    // Calculate TTL
    let ttl: number | undefined;
    if (options?.expirationTtl) {
      ttl = options.expirationTtl;
    } else if (options?.expiration) {
      ttl = options.expiration - Math.floor(Date.now() / 1000);
      if (ttl <= 0) {
        // Already expired, don't store
        return;
      }
    }

    // Store the value
    if (ttl) {
      await this.redis.setex(fullKey, ttl, stringValue);
    } else {
      await this.redis.set(fullKey, stringValue);
    }

    // Store metadata if provided
    if (options?.metadata) {
      const metadataKey = this.buildMetadataKey(key);
      const metadataValue = JSON.stringify(options.metadata);
      if (ttl) {
        await this.redis.setex(metadataKey, ttl, metadataValue);
      } else {
        await this.redis.set(metadataKey, metadataValue);
      }
    }
  }

  /**
   * Delete a value from the store
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.buildKey(key);
    const metadataKey = this.buildMetadataKey(key);
    await this.redis.del(fullKey, metadataKey);
  }

  /**
   * List keys in the store
   */
  async list(options?: KVListOptions): Promise<KVListResult> {
    const pattern = options?.prefix
      ? `kv:${this.namespace}:${options.prefix}*`
      : `kv:${this.namespace}:*`;

    const limit = options?.limit || 1000;
    const cursor = options?.cursor || '0';

    // Use SCAN for efficient iteration
    const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', limit);

    // Filter out metadata keys
    const dataKeys = keys.filter((key) => !key.endsWith(':__metadata'));

    // Extract the key names (remove namespace prefix)
    const prefix = `kv:${this.namespace}:`;
    const keyNames = dataKeys.map((key) => ({
      name: key.slice(prefix.length),
    }));

    return {
      keys: keyNames,
      list_complete: nextCursor === '0',
      cursor: nextCursor === '0' ? undefined : nextCursor,
    };
  }
}

/**
 * Factory for creating KV stores
 */
export class KVStoreFactory {
  private redis: IORedis;
  private stores: Map<string, RedisKVStore> = new Map();

  constructor(redis: IORedis) {
    this.redis = redis;
  }

  /**
   * Get or create a KV store for a namespace
   */
  getStore(namespace: string): RedisKVStore {
    let store = this.stores.get(namespace);
    if (!store) {
      store = new RedisKVStore(this.redis, namespace);
      this.stores.set(namespace, store);
    }
    return store;
  }

  /**
   * Create all default KV namespaces used by the application
   */
  createDefaultStores(): {
    gmail_history_id: RedisKVStore;
    gmail_processing_threads: RedisKVStore;
    gmail_sub_age: RedisKVStore;
    pending_emails_status: RedisKVStore;
    pending_emails_payload: RedisKVStore;
    scheduled_emails: RedisKVStore;
    snoozed_emails: RedisKVStore;
  } {
    return {
      gmail_history_id: this.getStore('gmail_history_id'),
      gmail_processing_threads: this.getStore('gmail_processing_threads'),
      gmail_sub_age: this.getStore('gmail_sub_age'),
      pending_emails_status: this.getStore('pending_emails_status'),
      pending_emails_payload: this.getStore('pending_emails_payload'),
      scheduled_emails: this.getStore('scheduled_emails'),
      snoozed_emails: this.getStore('snoozed_emails'),
    };
  }
}

/**
 * Bulk delete keys from Redis
 * Replaces the Cloudflare bulk delete functionality
 */
export async function bulkDeleteRedisKeys(
  redis: IORedis,
  keys: string[],
): Promise<{ successful: number; failed: number }> {
  if (keys.length === 0) {
    return { successful: 0, failed: 0 };
  }

  try {
    const deleted = await redis.del(...keys);
    return { successful: deleted, failed: keys.length - deleted };
  } catch (error) {
    console.error('[KVStore] Bulk delete failed:', error);
    return { successful: 0, failed: keys.length };
  }
}
