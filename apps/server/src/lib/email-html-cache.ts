/**
 * Email HTML Preprocessing Cache
 *
 * Redis-backed cache for preprocessed email HTML in standalone mode.
 * The expensive preprocessEmailHtml() step (sanitizeHtml + cheerio + CSS sanitizer)
 * is deterministic for the same input HTML, so we cache its output keyed by
 * a hash of the raw HTML. applyEmailPreferences() still runs per-request
 * (cheap string concatenation for theme CSS + optional image blocking).
 *
 * Cache key format: eh:{md5hash}
 * Default TTL: 24 hours (email HTML never changes)
 */

import { createHash } from 'crypto';
import type { Redis } from 'ioredis';

const CACHE_PREFIX = 'eh:';
const DEFAULT_TTL_SECONDS = 86400; // 24 hours

let redisInstance: Redis | null = null;

/**
 * Initialize the email HTML cache with a Redis instance.
 * Call once during server startup.
 */
export function initEmailHtmlCache(redis: Redis): void {
  redisInstance = redis;
}

function hashHtml(html: string): string {
  return createHash('md5').update(html).digest('hex');
}

/**
 * Get cached preprocessed HTML.
 * Returns null on cache miss or error.
 */
export async function getCachedPreprocessedHtml(html: string): Promise<string | null> {
  if (!redisInstance) return null;

  try {
    const key = `${CACHE_PREFIX}${hashHtml(html)}`;
    return await redisInstance.get(key);
  } catch {
    return null;
  }
}

/**
 * Store preprocessed HTML in cache.
 * Non-blocking — errors are silently ignored.
 */
export function setCachedPreprocessedHtml(
  html: string,
  preprocessed: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): void {
  if (!redisInstance) return;

  const key = `${CACHE_PREFIX}${hashHtml(html)}`;
  redisInstance.set(key, preprocessed, 'EX', ttlSeconds).catch(() => {
    // Silently ignore cache write errors
  });
}
