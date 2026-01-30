/**
 * Thread Storage - Unified interface for storing thread data
 *
 * Provides a consistent API for storing and retrieving thread data that works with:
 * - Cloudflare R2 (for Cloudflare Workers deployment)
 * - MinIO/S3 (for self-hosted deployment)
 *
 * Usage:
 *   // In Cloudflare Workers mode:
 *   const storage = createThreadStorage({ r2Bucket: env.THREADS_BUCKET });
 *
 *   // In self-hosted mode:
 *   const storage = createThreadStorage({ objectStore: s3Store });
 *
 *   // Store thread
 *   await storage.putThread(connectionId, threadId, threadData);
 *
 *   // Retrieve thread
 *   const data = await storage.getThread(connectionId, threadId);
 */

import type { IGetThreadResponse } from '../types';
import type { IObjectStore } from './self-hosted';

/**
 * Thread storage interface
 */
export interface IThreadStorage {
  /**
   * Store thread data
   */
  putThread(
    connectionId: string,
    threadId: string,
    data: IGetThreadResponse | unknown,
  ): Promise<void>;

  /**
   * Retrieve thread data
   */
  getThread(connectionId: string, threadId: string): Promise<IGetThreadResponse | null>;

  /**
   * Delete thread data
   */
  deleteThread(connectionId: string, threadId: string): Promise<void>;

  /**
   * Check if thread exists
   */
  hasThread(connectionId: string, threadId: string): Promise<boolean>;
}

/**
 * Build the storage key for a thread
 */
function getThreadKey(connectionId: string, threadId: string): string {
  return `${connectionId}/${threadId}.json`;
}

/**
 * R2-backed thread storage for Cloudflare Workers
 */
export class R2ThreadStorage implements IThreadStorage {
  private bucket: R2Bucket;

  constructor(bucket: R2Bucket) {
    this.bucket = bucket;
  }

  async putThread(
    connectionId: string,
    threadId: string,
    data: IGetThreadResponse | unknown,
  ): Promise<void> {
    const key = getThreadKey(connectionId, threadId);
    await this.bucket.put(key, JSON.stringify(data), {
      customMetadata: { threadId },
    });
  }

  async getThread(connectionId: string, threadId: string): Promise<IGetThreadResponse | null> {
    const key = getThreadKey(connectionId, threadId);
    const result = await this.bucket.get(key);
    if (!result) {
      return null;
    }
    const text = await result.text();
    return JSON.parse(text) as IGetThreadResponse;
  }

  async deleteThread(connectionId: string, threadId: string): Promise<void> {
    const key = getThreadKey(connectionId, threadId);
    await this.bucket.delete(key);
  }

  async hasThread(connectionId: string, threadId: string): Promise<boolean> {
    const key = getThreadKey(connectionId, threadId);
    const result = await this.bucket.get(key);
    return result !== null;
  }
}

/**
 * S3/MinIO-backed thread storage for self-hosted deployments
 */
export class S3ThreadStorage implements IThreadStorage {
  private store: IObjectStore;

  constructor(store: IObjectStore) {
    this.store = store;
  }

  async putThread(
    connectionId: string,
    threadId: string,
    data: IGetThreadResponse | unknown,
  ): Promise<void> {
    const key = getThreadKey(connectionId, threadId);
    await this.store.put(key, JSON.stringify(data), {
      customMetadata: { threadId },
    });
  }

  async getThread(connectionId: string, threadId: string): Promise<IGetThreadResponse | null> {
    const key = getThreadKey(connectionId, threadId);
    const result = await this.store.get(key);
    if (!result) {
      return null;
    }
    const text = await result.text();
    return JSON.parse(text) as IGetThreadResponse;
  }

  async deleteThread(connectionId: string, threadId: string): Promise<void> {
    const key = getThreadKey(connectionId, threadId);
    await this.store.delete(key);
  }

  async hasThread(connectionId: string, threadId: string): Promise<boolean> {
    const key = getThreadKey(connectionId, threadId);
    return this.store.exists(key);
  }
}

/**
 * Configuration for creating thread storage
 */
export interface ThreadStorageConfig {
  /** R2 bucket (for Cloudflare Workers mode) */
  r2Bucket?: R2Bucket;
  /** S3/MinIO object store (for self-hosted mode) */
  objectStore?: IObjectStore;
}

/**
 * Create a thread storage instance based on configuration
 */
export function createThreadStorage(config: ThreadStorageConfig): IThreadStorage {
  if (config.objectStore) {
    return new S3ThreadStorage(config.objectStore);
  }

  if (config.r2Bucket) {
    return new R2ThreadStorage(config.r2Bucket);
  }

  throw new Error('Either objectStore or r2Bucket must be provided');
}

// Global thread storage instance (set during server initialization)
let globalThreadStorage: IThreadStorage | null = null;

/**
 * Set the global thread storage instance
 * Called during server initialization
 */
export function setGlobalThreadStorage(storage: IThreadStorage): void {
  globalThreadStorage = storage;
}

/**
 * Get the global thread storage instance
 * Throws if not initialized
 */
export function getThreadStorage(): IThreadStorage {
  if (!globalThreadStorage) {
    throw new Error('Thread storage not initialized. Call setGlobalThreadStorage() first.');
  }
  return globalThreadStorage;
}

/**
 * Check if thread storage is initialized
 */
export function isThreadStorageInitialized(): boolean {
  return globalThreadStorage !== null;
}
