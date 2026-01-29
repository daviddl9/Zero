import { Redis as UpstashRedis } from '@upstash/redis';
import { Resend } from 'resend';
import { env } from '../env';
import {
  NativeRedisClient,
  createNativeRedisClient,
  shouldUseNativeRedis,
} from './self-hosted';

export const resend = () =>
  env.RESEND_API_KEY
    ? new Resend(env.RESEND_API_KEY)
    : { emails: { send: async (...args: unknown[]) => console.log(args) } };

/**
 * Unified Redis interface that works with both Upstash and native Redis
 */
export interface UnifiedRedis {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { ex?: number }): Promise<void>;
  del(key: string): Promise<void>;
}

// Singleton for native Redis client in self-hosted mode
let nativeRedisClient: NativeRedisClient | null = null;

/**
 * Get the native Redis client (singleton)
 */
export function getNativeRedisClient(): NativeRedisClient {
  if (!nativeRedisClient) {
    nativeRedisClient = createNativeRedisClient();
  }
  return nativeRedisClient;
}

/**
 * Adapter to make NativeRedisClient compatible with Upstash Redis interface
 */
class NativeRedisAdapter implements UnifiedRedis {
  private client: NativeRedisClient;

  constructor(client: NativeRedisClient) {
    this.client = client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, options?: { ex?: number }): Promise<void> {
    await this.client.set(key, value, options);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}

/**
 * Adapter to make Upstash Redis compatible with UnifiedRedis interface
 */
class UpstashRedisAdapter implements UnifiedRedis {
  private client: UpstashRedis;

  constructor(client: UpstashRedis) {
    this.client = client;
  }

  async get(key: string): Promise<string | null> {
    const value = await this.client.get(key);
    return typeof value === 'string' ? value : value ? JSON.stringify(value) : null;
  }

  async set(key: string, value: string, options?: { ex?: number }): Promise<void> {
    if (options?.ex) {
      await this.client.set(key, value, { ex: options.ex });
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}

/**
 * Get a Redis client - uses native Redis in self-hosted mode, Upstash otherwise
 *
 * Returns an Upstash-compatible interface for backwards compatibility with existing code.
 * In self-hosted mode, this wraps the native ioredis client.
 */
export const redis = (): UpstashRedis => {
  if (shouldUseNativeRedis()) {
    // Return native Redis with Upstash-compatible interface
    // We use a proxy to make it compatible with the Upstash Redis interface
    const nativeClient = getNativeRedisClient();
    return new Proxy({} as UpstashRedis, {
      get(_, prop) {
        if (prop === 'get') {
          return (key: string) => nativeClient.get(key);
        }
        if (prop === 'set') {
          return (key: string, value: string, options?: { ex?: number }) =>
            nativeClient.set(key, value, options);
        }
        if (prop === 'del') {
          return (key: string) => nativeClient.del(key);
        }
        // For any other methods, log a warning and return a no-op
        console.warn(`[Redis] Method ${String(prop)} not implemented in native Redis adapter`);
        return () => Promise.resolve(null);
      },
    });
  }

  // Use Upstash Redis (Cloudflare Workers mode)
  return new UpstashRedis({ url: env.REDIS_URL, token: env.REDIS_TOKEN });
};

/**
 * Get a unified Redis interface (for new code that doesn't need Upstash-specific features)
 */
export const getUnifiedRedis = (): UnifiedRedis => {
  if (shouldUseNativeRedis()) {
    return new NativeRedisAdapter(getNativeRedisClient());
  }
  return new UpstashRedisAdapter(new UpstashRedis({ url: env.REDIS_URL, token: env.REDIS_TOKEN }));
};

export const twilio = () => {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
    console.log('[TWILIO] Not configured - using mock (phone verification will not work)');
    return {
      messages: {
        send: async (to: string, body: string) =>
          console.log(`[TWILIO:MOCK] Would send to ${to}: ${body}`),
      },
    };
  }

  const send = async (to: string, body: string) => {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`,
        },
        body: new URLSearchParams({
          To: to,
          From: env.TWILIO_PHONE_NUMBER,
          Body: body,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send OTP: ${error}`);
    }
  };

  return {
    messages: {
      send,
    },
  };
};
