/**
 * BIMI Cache
 *
 * Redis-backed cache for BIMI (Brand Indicators for Message Identification) lookups.
 * Caches both positive results (SVG logos) and negative results (no BIMI record)
 * to avoid repeated DNS lookups and SVG fetches.
 *
 * Cache key format: bimi:{domain}
 * Default TTL: 24 hours
 */

import type { Redis } from 'ioredis';

const CACHE_PREFIX = 'bimi:';
const DEFAULT_TTL_SECONDS = 86400; // 24 hours

let redisInstance: Redis | null = null;

export interface BimiCacheEntry {
  domain: string;
  bimiRecord: {
    version?: string;
    logoUrl?: string;
    authorityUrl?: string;
  } | null;
  logo: {
    url: string;
    svgContent: string;
  } | null;
}

/**
 * Initialize the BIMI cache with a Redis instance.
 * Call once during server startup.
 */
export function initBimiCache(redis: Redis): void {
  redisInstance = redis;
}

/**
 * Get cached BIMI result for a domain.
 * Returns null on cache miss or error.
 */
export async function getCachedBimi(domain: string): Promise<BimiCacheEntry | null> {
  if (!redisInstance) return null;

  try {
    const key = `${CACHE_PREFIX}${domain}`;
    const cached = await redisInstance.get(key);
    if (!cached) return null;
    return JSON.parse(cached) as BimiCacheEntry;
  } catch {
    return null;
  }
}

/**
 * Store BIMI result in cache.
 * Non-blocking — errors are silently ignored.
 */
export function setCachedBimi(
  domain: string,
  data: BimiCacheEntry,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): void {
  if (!redisInstance) return;

  const key = `${CACHE_PREFIX}${domain}`;
  redisInstance.set(key, JSON.stringify(data), 'EX', ttlSeconds).catch(() => {
    // Silently ignore cache write errors
  });
}
