/**
 * Thread List Cache
 *
 * Redis-backed cache for thread list responses in standalone mode.
 * Eliminates redundant Gmail API calls for inbox/folder listing.
 *
 * Cache key format: tl:{connectionId}:{folder}:{labelIds}:{query}:{pageToken}
 * Default TTL: 60 seconds (serve stale while background refreshes)
 */

import type { Redis } from 'ioredis';
import type { IGetThreadsResponse } from './driver/types';

const CACHE_PREFIX = 'tl:';
const DEFAULT_TTL_SECONDS = 60;

let redisInstance: Redis | null = null;

/**
 * Initialize the thread list cache with a Redis instance.
 * Call once during server startup.
 */
export function initThreadListCache(redis: Redis): void {
  redisInstance = redis;
}

function buildCacheKey(
  connectionId: string,
  params: {
    folder?: string;
    labelIds?: string[];
    q?: string;
    pageToken?: string;
  },
): string {
  const folder = params.folder || 'INBOX';
  const labels = params.labelIds?.sort().join(',') || '';
  const query = params.q || '';
  const page = params.pageToken || '';
  return `${CACHE_PREFIX}${connectionId}:${folder}:${labels}:${query}:${page}`;
}

/**
 * Get cached thread list response.
 * Returns null on cache miss or error.
 */
export async function getCachedThreadList(
  connectionId: string,
  params: {
    folder?: string;
    labelIds?: string[];
    q?: string;
    pageToken?: string;
  },
): Promise<IGetThreadsResponse | null> {
  if (!redisInstance) return null;

  try {
    const key = buildCacheKey(connectionId, params);
    const cached = await redisInstance.get(key);
    if (!cached) return null;
    return JSON.parse(cached) as IGetThreadsResponse;
  } catch {
    return null;
  }
}

/**
 * Store thread list response in cache.
 * Non-blocking — errors are silently ignored.
 */
export function setCachedThreadList(
  connectionId: string,
  params: {
    folder?: string;
    labelIds?: string[];
    q?: string;
    pageToken?: string;
  },
  data: IGetThreadsResponse,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): void {
  if (!redisInstance) return;

  const key = buildCacheKey(connectionId, params);
  redisInstance.set(key, JSON.stringify(data), 'EX', ttlSeconds).catch(() => {
    // Silently ignore cache write errors
  });
}

/**
 * Invalidate all cached thread lists for a connection.
 * Call after actions that modify threads (archive, label, delete, etc).
 */
export async function invalidateThreadListCache(connectionId: string): Promise<void> {
  if (!redisInstance) return;

  try {
    // Scan for all keys with this connection prefix and delete them
    const pattern = `${CACHE_PREFIX}${connectionId}:*`;
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redisInstance.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redisInstance.del(...keys);
      }
    } while (cursor !== '0');
  } catch {
    // Silently ignore invalidation errors
  }
}
