import { getActiveConnection, getZeroDB } from '../lib/server-utils';
import { Ratelimit, type RatelimitConfig } from '@upstash/ratelimit';
import type { HonoContext, HonoVariables } from '../ctx';
import { initTRPC, TRPCError } from '@trpc/server';
import { createLoggingMiddleware } from '../lib/trpc-logging';

import { redis, getNativeRedisClient } from '../lib/services';
import {
  NativeRedisRateLimiter,
  shouldUseNativeRedis,
  isSelfHostedMode,
} from '../lib/self-hosted';
import type { Context } from 'hono';
import superjson from 'superjson';

// Helper to get client IP - works in both Cloudflare and standalone modes
function getClientIp(c: Context<HonoContext>): string {
  // Try standard headers first (works in standalone mode with reverse proxy)
  const forwardedFor = c.req.header('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'no-ip';
  }

  const realIp = c.req.header('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // In Cloudflare mode, use getConnInfo
  if (!isSelfHostedMode()) {
    try {
      const { getConnInfo } = require('hono/cloudflare-workers');
      return getConnInfo(c).remote.address ?? 'no-ip';
    } catch {
      // Fall through to default
    }
  }

  return 'no-ip';
}

// Helper to get NODE_ENV - works in both modes
function getNodeEnv(): string {
  if (isSelfHostedMode()) {
    return process.env.NODE_ENV || 'development';
  }
  try {
    const { env } = require('../env');
    return env.NODE_ENV || 'development';
  } catch {
    return process.env.NODE_ENV || 'development';
  }
}

type TrpcContext = {
  c: Context<HonoContext>;
} & HonoVariables;

const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });

const loggingMiddleware = createLoggingMiddleware();

export const router = t.router;
export const publicProcedure = t.procedure.use(loggingMiddleware);

export const privateProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const { addRequestSpan, completeRequestSpan } = await import('../lib/trace-context');

  // Start auth validation span
  const authSpan = addRequestSpan(ctx.c, 'trpc_auth_validation', {
    hasSessionUser: !!ctx.sessionUser,
    procedure: 'private',
  }, {
    'trpc.auth_required': 'true'
  });

  if (!ctx.sessionUser) {
    if (authSpan) {
      completeRequestSpan(ctx.c, authSpan.id, {
        success: false,
        reason: 'no_session_user',
      }, 'UNAUTHORIZED: No session user found');
    }

    throw new TRPCError({
      code: 'UNAUTHORIZED',
    });
  }

  if (authSpan) {
    completeRequestSpan(ctx.c, authSpan.id, {
      success: true,
      userId: ctx.sessionUser.id,
    });
  }

  return next({ ctx: { ...ctx, sessionUser: ctx.sessionUser } });
});

export const activeConnectionProcedure = privateProcedure.use(async ({ ctx, next }) => {
  const { addRequestSpan, completeRequestSpan } = await import('../lib/trace-context');

  // Start connection validation span
  const connectionSpan = addRequestSpan(ctx.c, 'trpc_connection_validation', {
    userId: ctx.sessionUser.id,
  }, {
    'trpc.connection_required': 'true'
  });

  try {
    const activeConnection = await getActiveConnection();

    if (connectionSpan) {
      completeRequestSpan(ctx.c, connectionSpan.id, {
        success: true,
        connectionId: activeConnection.id,
        connectionType: activeConnection.providerId,
      });
    }

    return next({ ctx: { ...ctx, activeConnection } });
  } catch (err) {
    if (connectionSpan) {
      completeRequestSpan(ctx.c, connectionSpan.id, {
        success: false,
        reason: 'connection_not_found',
      }, err instanceof Error ? err.message : 'Failed to get active connection');
    }

    await ctx.c.var.auth.api.signOut({ headers: ctx.c.req.raw.headers });
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: err instanceof Error ? err.message : 'Failed to get active connection',
    });
  }
});

const permissionErrors = ['precondition check', 'insufficient permission', 'invalid credentials'];

export const activeDriverProcedure = activeConnectionProcedure.use(async ({ ctx, next }) => {
  const { activeConnection, sessionUser } = ctx;
  const res = await next({ ctx: { ...ctx } });

  if (!res.ok) {
    const errorMessage = res.error.message.toLowerCase();

    const isPermissionError = permissionErrors.some((errorType) =>
      errorMessage.includes(errorType),
    );

    if (isPermissionError) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Required scopes missing',
        cause: res.error,
      });
    }

    // Handle token expiration/refresh issues
    if (errorMessage.includes('invalid_grant')) {
      // Remove the access token and refresh token
      const db = await getZeroDB(sessionUser.id);
      await db.updateConnection(activeConnection.id, {
        accessToken: null,
        refreshToken: null,
      });

      ctx.c.header(
        'X-Zero-Redirect',
        `/settings/connections?disconnectedConnectionId=${activeConnection.id}`,
      );

      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Connection expired. Please reconnect.',
        cause: res.error,
      });
    }
  }

  return res;
});

/**
 * Parse Upstash limiter config to extract points and duration
 * Upstash limiter is a function like: Ratelimit.slidingWindow(10, "60 s")
 */
function parseUpstashLimiter(_limiter: RatelimitConfig['limiter']): { points: number; duration: number } {
  // Default values - the Upstash limiter config is opaque, so we use sensible defaults
  return { points: 10, duration: 60 };
}

export const createRateLimiterMiddleware = (config: {
  limiter: RatelimitConfig['limiter'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generatePrefix: (ctx: TrpcContext, input: any) => string;
}) =>
  t.middleware(async ({ next, ctx, input }) => {
    // Skip rate limiting in non-production if Redis fails
    try {
      const finalIp = getClientIp(ctx.c);
      const prefix = config.generatePrefix(ctx, input);

      let success: boolean;
      let limit: number;
      let reset: number;
      let remaining: number;

      if (shouldUseNativeRedis()) {
        // Use native Redis rate limiter for self-hosted mode
        const nativeClient = getNativeRedisClient();
        const limiterConfig = parseUpstashLimiter(config.limiter);

        const rateLimiter = new NativeRedisRateLimiter(nativeClient.getClient(), {
          points: limiterConfig.points,
          duration: limiterConfig.duration,
          keyPrefix: `ratelimit:${prefix}:`,
        });

        const result = await rateLimiter.limit(finalIp);
        success = result.success;
        limit = result.limit;
        reset = result.reset;
        remaining = result.remaining;
      } else {
        // Use Upstash rate limiter for Cloudflare Workers mode
        const ratelimiter = new Ratelimit({
          redis: redis(),
          limiter: config.limiter,
          analytics: true,
          prefix,
        });

        const result = await ratelimiter.limit(finalIp);
        success = result.success;
        limit = result.limit;
        reset = result.reset;
        remaining = result.remaining;
      }

      ctx.c.res.headers.append('X-RateLimit-Limit', limit.toString());
      ctx.c.res.headers.append('X-RateLimit-Remaining', remaining.toString());
      ctx.c.res.headers.append('X-RateLimit-Reset', reset.toString());

      if (!success) {
        console.log(`Rate limit exceeded for IP ${finalIp}.`);
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many requests. Please try again later.',
        });
      }
    } catch (error) {
      // In production, re-throw rate limit errors
      if (getNodeEnv() === 'production') {
        throw error;
      }
      // In dev/local, log and skip rate limiting if Redis unavailable
      if (error instanceof TRPCError && error.code === 'TOO_MANY_REQUESTS') {
        throw error; // Re-throw actual rate limit exceeded errors
      }
      console.warn(
        '[Rate Limit] Redis unavailable, skipping rate limiting:',
        error instanceof Error ? error.message : error,
      );
    }

    return next();
  });
