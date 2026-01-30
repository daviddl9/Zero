/**
 * Durable Storage - PostgreSQL-backed Durable Object Storage
 *
 * Provides a Cloudflare Durable Object storage-compatible interface backed by PostgreSQL.
 * This replaces Durable Object storage for self-hosted deployments.
 */

import type { Redis as IORedis } from 'ioredis';

/**
 * Options for storage operations
 */
export interface StorageOptions {
  /** Allow concurrent modifications */
  allowConcurrency?: boolean;
  /** Don't wait for write to complete */
  noCache?: boolean;
}

/**
 * PostgreSQL-backed Durable Storage that mimics DO storage interface
 */
export class DurableStorage {
  private objectId: string;
  private objectClass: string;
  private db: {
    query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
  };
  private cache: Map<string, unknown> = new Map();
  private redis?: IORedis;

  constructor(
    objectId: string,
    objectClass: string,
    db: { query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> },
    redis?: IORedis,
  ) {
    this.objectId = objectId;
    this.objectClass = objectClass;
    this.db = db;
    this.redis = redis;
  }

  /**
   * Get the cache key for Redis
   */
  private getCacheKey(key: string): string {
    return `do:${this.objectClass}:${this.objectId}:${key}`;
  }

  /**
   * Get a single value from storage
   */
  async get<T = unknown>(key: string, _options?: StorageOptions): Promise<T | undefined>;
  /**
   * Get multiple values from storage
   */
  async get<T = unknown>(keys: string[], _options?: StorageOptions): Promise<Map<string, T>>;
  async get<T = unknown>(
    keyOrKeys: string | string[],
    _options?: StorageOptions,
  ): Promise<T | undefined | Map<string, T>> {
    if (typeof keyOrKeys === 'string') {
      return this.getSingle<T>(keyOrKeys, options);
    }

    const result = new Map<string, T>();
    const keysToFetch: string[] = [];

    // Check cache first
    for (const key of keyOrKeys) {
      if (this.cache.has(key)) {
        result.set(key, this.cache.get(key) as T);
      } else {
        keysToFetch.push(key);
      }
    }

    if (keysToFetch.length === 0) {
      return result;
    }

    // Query database for remaining keys
    const placeholders = keysToFetch.map((_, i) => `$${i + 3}`).join(', ');
    const dbResult = await this.db.query<{ key: string; value: string }>(
      `SELECT key, value FROM durable_object_storage
       WHERE object_class = $1 AND object_id = $2 AND key IN (${placeholders})`,
      [this.objectClass, this.objectId, ...keysToFetch],
    );

    for (const row of dbResult.rows) {
      try {
        const value = JSON.parse(row.value) as T;
        result.set(row.key, value);
        this.cache.set(row.key, value);
      } catch {
        // Invalid JSON, skip
      }
    }

    return result;
  }

  /**
   * Internal single key get
   */
  private async getSingle<T>(key: string, _options?: StorageOptions): Promise<T | undefined> {
    // Check local cache first
    if (this.cache.has(key)) {
      return this.cache.get(key) as T;
    }

    // Query database
    const result = await this.db.query<{ value: string }>(
      `SELECT value FROM durable_object_storage
       WHERE object_class = $1 AND object_id = $2 AND key = $3`,
      [this.objectClass, this.objectId, key],
    );

    if (result.rows.length === 0) {
      return undefined;
    }

    try {
      const value = JSON.parse(result.rows[0].value) as T;
      this.cache.set(key, value);
      return value;
    } catch {
      return undefined;
    }
  }

  /**
   * Put a single value into storage
   */
  async put<T>(key: string, value: T, _options?: StorageOptions): Promise<void>;
  async put<T>(entries: Map<string, T>, _options?: StorageOptions): Promise<void>;
  async put<T>(
    keyOrEntries: string | Map<string, T>,
    valueOrOptions?: T | StorageOptions,
    _options?: StorageOptions,
  ): Promise<void> {
    if (typeof keyOrEntries === 'string') {
      await this.putSingle(keyOrEntries, valueOrOptions as T, options);
    } else {
      await this.putMultiple(keyOrEntries, valueOrOptions as StorageOptions);
    }
  }

  /**
   * Internal single key put
   */
  private async putSingle<T>(key: string, value: T, _options?: StorageOptions): Promise<void> {
    const jsonValue = JSON.stringify(value);

    await this.db.query(
      `INSERT INTO durable_object_storage (object_class, object_id, key, value, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (object_class, object_id, key)
       DO UPDATE SET value = $4, updated_at = NOW()`,
      [this.objectClass, this.objectId, key, jsonValue],
    );

    this.cache.set(key, value);

    // Update Redis cache
    if (this.redis) {
      await this.redis.setex(this.getCacheKey(key), 3600, jsonValue);
    }
  }

  /**
   * Internal multiple key put
   */
  private async putMultiple<T>(entries: Map<string, T>, _options?: StorageOptions): Promise<void> {
    if (entries.size === 0) return;

    // Build bulk insert query
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let idx = 1;

    for (const [key, value] of entries) {
      const jsonValue = JSON.stringify(value);
      placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, NOW())`);
      values.push(this.objectClass, this.objectId, key, jsonValue);
      idx += 4;

      // Update local cache
      this.cache.set(key, value);

      // Update Redis cache
      if (this.redis) {
        await this.redis.setex(this.getCacheKey(key), 3600, jsonValue);
      }
    }

    await this.db.query(
      `INSERT INTO durable_object_storage (object_class, object_id, key, value, updated_at)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (object_class, object_id, key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      values,
    );
  }

  /**
   * Delete a key from storage
   */
  async delete(key: string, _options?: StorageOptions): Promise<boolean>;
  async delete(keys: string[], _options?: StorageOptions): Promise<number>;
  async delete(
    keyOrKeys: string | string[],
    _options?: StorageOptions,
  ): Promise<boolean | number> {
    if (typeof keyOrKeys === 'string') {
      return this.deleteSingle(keyOrKeys, options);
    }
    return this.deleteMultiple(keyOrKeys, options);
  }

  /**
   * Internal single key delete
   */
  private async deleteSingle(key: string, _options?: StorageOptions): Promise<boolean> {
    const result = await this.db.query<{ count: number }>(
      `WITH deleted AS (
         DELETE FROM durable_object_storage
         WHERE object_class = $1 AND object_id = $2 AND key = $3
         RETURNING 1
       )
       SELECT COUNT(*) as count FROM deleted`,
      [this.objectClass, this.objectId, key],
    );

    this.cache.delete(key);

    if (this.redis) {
      await this.redis.del(this.getCacheKey(key));
    }

    return result.rows[0]?.count > 0;
  }

  /**
   * Internal multiple key delete
   */
  private async deleteMultiple(keys: string[], _options?: StorageOptions): Promise<number> {
    if (keys.length === 0) return 0;

    const placeholders = keys.map((_, i) => `$${i + 3}`).join(', ');
    const result = await this.db.query<{ count: number }>(
      `WITH deleted AS (
         DELETE FROM durable_object_storage
         WHERE object_class = $1 AND object_id = $2 AND key IN (${placeholders})
         RETURNING 1
       )
       SELECT COUNT(*) as count FROM deleted`,
      [this.objectClass, this.objectId, ...keys],
    );

    for (const key of keys) {
      this.cache.delete(key);
      if (this.redis) {
        await this.redis.del(this.getCacheKey(key));
      }
    }

    return result.rows[0]?.count || 0;
  }

  /**
   * Delete all keys from storage for this object
   */
  async deleteAll(_options?: StorageOptions): Promise<void> {
    await this.db.query(
      `DELETE FROM durable_object_storage WHERE object_class = $1 AND object_id = $2`,
      [this.objectClass, this.objectId],
    );

    this.cache.clear();

    // Clear Redis cache (pattern delete)
    if (this.redis) {
      const pattern = `do:${this.objectClass}:${this.objectId}:*`;
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } while (cursor !== '0');
    }
  }

  /**
   * List keys in storage
   */
  async list<T = unknown>(options?: {
    prefix?: string;
    start?: string;
    end?: string;
    limit?: number;
    reverse?: boolean;
  }): Promise<Map<string, T>> {
    let query = `SELECT key, value FROM durable_object_storage
                 WHERE object_class = $1 AND object_id = $2`;
    const params: unknown[] = [this.objectClass, this.objectId];
    let paramIdx = 3;

    if (options?.prefix) {
      query += ` AND key LIKE $${paramIdx}`;
      params.push(`${options.prefix}%`);
      paramIdx++;
    }

    if (options?.start) {
      query += ` AND key >= $${paramIdx}`;
      params.push(options.start);
      paramIdx++;
    }

    if (options?.end) {
      query += ` AND key < $${paramIdx}`;
      params.push(options.end);
      paramIdx++;
    }

    query += ` ORDER BY key ${options?.reverse ? 'DESC' : 'ASC'}`;

    if (options?.limit) {
      query += ` LIMIT $${paramIdx}`;
      params.push(options.limit);
    }

    const result = await this.db.query<{ key: string; value: string }>(query, params);

    const map = new Map<string, T>();
    for (const row of result.rows) {
      try {
        map.set(row.key, JSON.parse(row.value) as T);
      } catch {
        // Invalid JSON, skip
      }
    }

    return map;
  }

  /**
   * Transaction support (simplified - runs operations in sequence)
   */
  async transaction<T>(closure: (txn: DurableStorage) => Promise<T>): Promise<T> {
    // For now, just run the closure directly
    // A full implementation would use PostgreSQL transactions
    return closure(this);
  }

  /**
   * Get alarm time (not implemented for self-hosted)
   */
  async getAlarm(): Promise<number | null> {
    console.warn('[DurableStorage] Alarms not supported in self-hosted mode');
    return null;
  }

  /**
   * Set alarm time (not implemented for self-hosted)
   */
  async setAlarm(_scheduledTime: number | Date): Promise<void> {
    console.warn('[DurableStorage] Alarms not supported in self-hosted mode');
    // For self-hosted, use BullMQ scheduled jobs instead
  }

  /**
   * Delete alarm (not implemented for self-hosted)
   */
  async deleteAlarm(): Promise<void> {
    console.warn('[DurableStorage] Alarms not supported in self-hosted mode');
  }

  /**
   * Sync to ensure all writes are persisted
   */
  async sync(): Promise<void> {
    // All writes are already synchronous in PostgreSQL
    // This is a no-op for compatibility
  }
}

/**
 * SQL for creating the durable_object_storage table
 */
export const DURABLE_STORAGE_SCHEMA = `
CREATE TABLE IF NOT EXISTS durable_object_storage (
  object_class TEXT NOT NULL,
  object_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (object_class, object_id, key)
);

CREATE INDEX IF NOT EXISTS idx_durable_storage_class_id
  ON durable_object_storage (object_class, object_id);

CREATE INDEX IF NOT EXISTS idx_durable_storage_updated
  ON durable_object_storage (updated_at);
`;

/**
 * Factory for creating DurableStorage instances
 */
export class DurableStorageFactory {
  private db: { query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> };
  private redis?: IORedis;
  private instances: Map<string, DurableStorage> = new Map();

  constructor(
    db: { query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> },
    redis?: IORedis,
  ) {
    this.db = db;
    this.redis = redis;
  }

  /**
   * Get or create a DurableStorage instance
   */
  getStorage(objectClass: string, objectId: string): DurableStorage {
    const key = `${objectClass}:${objectId}`;
    let storage = this.instances.get(key);
    if (!storage) {
      storage = new DurableStorage(objectId, objectClass, this.db, this.redis);
      this.instances.set(key, storage);
    }
    return storage;
  }

  /**
   * Initialize the storage schema
   */
  async initialize(): Promise<void> {
    await this.db.query(DURABLE_STORAGE_SCHEMA);
    console.log('[DurableStorage] Schema initialized');
  }
}
