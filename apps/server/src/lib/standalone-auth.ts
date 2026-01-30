/**
 * Standalone Auth Module
 *
 * Creates a better-auth instance configured for standalone/self-hosted mode.
 * Uses native Redis for session storage and direct database access.
 */

import { createAuthMiddleware, phoneNumber, jwt, bearer, mcp } from 'better-auth/plugins';
import { type Account, betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getBrowserTimezone, isValidTimezone } from './timezones';
import { getSocialProviders } from './auth-providers';
import { defaultUserSettings } from './schemas';
import { createDriver } from './driver';
import { APIError } from 'better-auth/api';
import { type EProviders } from '../types';
import type { DB } from '../db';
import type { Redis } from 'ioredis';
import { standaloneEnv } from './standalone-env';
import { getStandaloneZeroDB, resetConnection } from './standalone-server-utils';

/**
 * Create a standalone auth instance
 *
 * @param db - Drizzle database instance
 * @param redis - ioredis client for session storage
 */
export function createStandaloneAuth(db: DB, redis: Redis) {
  const env = standaloneEnv();

  // Connection handler hook - called after account create/update
  const connectionHandlerHook = async (account: Account) => {
    if (!account.accessToken || !account.refreshToken) {
      console.error('Missing Access/Refresh Tokens', { account });
      throw new APIError('EXPECTATION_FAILED', {
        message: 'Missing Access/Refresh Tokens, contact us on Discord for support',
      });
    }

    const driver = createDriver(account.providerId, {
      auth: {
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        userId: account.userId,
        email: '',
      },
    });

    const userInfo = await driver.getUserInfo().catch(async () => {
      try {
        if (account.accessToken) {
          await driver.revokeToken(account.accessToken);
          await resetConnection(account.id);
        }
      } catch (cleanupError) {
        console.error('Failed to cleanup after getUserInfo error:', cleanupError);
      }
      throw new APIError('UNAUTHORIZED', { message: 'Failed to get user info from provider' });
    });

    if (!userInfo?.address) {
      console.error('Missing email in user info:', { userInfo });
      try {
        await Promise.allSettled(
          [account.accessToken, account.refreshToken]
            .filter(Boolean)
            .map((t) => driver.revokeToken(t as string)),
        );
        await resetConnection(account.id);
      } catch (error) {
        console.error('Failed to revoke tokens:', error);
      }
      throw new APIError('BAD_REQUEST', { message: 'Missing email in user info from provider' });
    }

    const updatingInfo = {
      name: userInfo.name || 'Unknown',
      picture: userInfo.photo || '',
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      scope: driver.getScope(),
      expiresAt: new Date(Date.now() + (account.accessTokenExpiresAt?.getTime() || 3600000)),
    };

    const dbRpc = getStandaloneZeroDB(account.userId);
    await dbRpc.createConnection(
      account.providerId as EProviders,
      userInfo.address,
      updatingInfo,
    );

    // Note: In standalone mode, we skip the email campaign and subscription queue
    // as those require Cloudflare-specific features
    console.log(`[Standalone Auth] Connection created for user ${account.userId}`);
  };

  // Twilio mock for standalone (or real if configured)
  const twilioClient = {
    messages: {
      send: async (to: string, body: string) => {
        if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER) {
          const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
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
        } else {
          console.log(`[Standalone Auth] Would send OTP to ${to}: ${body}`);
        }
      },
    },
  };

  // Resend mock for standalone (or real if configured)
  const resendClient = {
    emails: {
      send: async (options: {
        from: string;
        to: string;
        subject: string;
        html?: string;
        react?: unknown;
        scheduledAt?: string;
      }) => {
        if (env.RESEND_API_KEY) {
          const { Resend } = await import('resend');
          const resend = new Resend(env.RESEND_API_KEY);
          return resend.emails.send(options as Parameters<typeof resend.emails.send>[0]);
        } else {
          console.log(`[Standalone Auth] Would send email to ${options.to}: ${options.subject}`);
        }
      },
    },
  };

  return betterAuth({
    plugins: [
      mcp({
        loginPage: env.VITE_PUBLIC_APP_URL + '/login',
      }),
      jwt(),
      bearer(),
      phoneNumber({
        sendOTP: async ({ code, phoneNumber: phone }) => {
          await twilioClient.messages
            .send(phone, `Your verification code is: ${code}, do not share it with anyone.`)
            .catch((error) => {
              console.error('Failed to send OTP', error);
              throw new APIError('INTERNAL_SERVER_ERROR', {
                message: `Failed to send OTP, ${error.message}`,
              });
            });
        },
      }),
    ],
    user: {
      deleteUser: {
        enabled: true,
        async sendDeleteAccountVerification(data) {
          const verificationUrl = data.url;

          await resendClient.emails.send({
            from: '0.email <no-reply@0.email>',
            to: data.user.email,
            subject: 'Delete your 0.email account',
            html: `
            <h2>Delete Your 0.email Account</h2>
            <p>Click the link below to delete your account:</p>
            <a href="${verificationUrl}">${verificationUrl}</a>
          `,
          });
        },
        beforeDelete: async (user) => {
          const dbRpc = getStandaloneZeroDB(user.id);
          const connections = await dbRpc.findManyConnections();

          const revokedAccounts = (
            await Promise.allSettled(
              connections.map(async (conn) => {
                if (!conn.accessToken || !conn.refreshToken) return false;
                const driver = createDriver(conn.providerId, {
                  auth: {
                    accessToken: conn.accessToken,
                    refreshToken: conn.refreshToken,
                    userId: user.id,
                    email: conn.email,
                  },
                });
                const token = conn.refreshToken;
                return await driver.revokeToken(token || '');
              }),
            )
          ).map((result) => {
            if (result.status === 'fulfilled') {
              return result.value;
            }
            return false;
          });

          if (revokedAccounts.every((value) => !!value)) {
            console.log('Failed to revoke some accounts');
          }

          await dbRpc.deleteUser();
        },
      },
    },
    databaseHooks: {
      account: {
        create: {
          after: connectionHandlerHook,
        },
        update: {
          after: connectionHandlerHook,
        },
      },
    },
    emailAndPassword: {
      enabled: false,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        await resendClient.emails.send({
          from: '0.email <onboarding@0.email>',
          to: user.email,
          subject: 'Reset your password',
          html: `
            <h2>Reset Your Password</h2>
            <p>Click the link below to reset your password:</p>
            <a href="${url}">${url}</a>
            <p>If you didn't request this, you can safely ignore this email.</p>
          `,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: false,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, token }) => {
        const verificationUrl = `${env.VITE_PUBLIC_APP_URL}/api/auth/verify-email?token=${token}&callbackURL=/settings/connections`;

        await resendClient.emails.send({
          from: '0.email <onboarding@0.email>',
          to: user.email,
          subject: 'Verify your 0.email account',
          html: `
            <h2>Verify Your 0.email Account</h2>
            <p>Click the link below to verify your email:</p>
            <a href="${verificationUrl}">${verificationUrl}</a>
          `,
        });
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        // all hooks that run on sign-up routes
        if (ctx.path.startsWith('/sign-up')) {
          // only true if this request is from a new user
          const newSession = ctx.context.newSession;
          if (newSession) {
            // Check if user already has settings
            const dbRpc = getStandaloneZeroDB(newSession.user.id);
            const existingSettings = await dbRpc.findUserSettings();

            if (!existingSettings) {
              // get timezone from vercel's header
              const headerTimezone = ctx.headers?.get('x-vercel-ip-timezone');
              // validate timezone from header or fallback to browser timezone
              const timezone =
                headerTimezone && isValidTimezone(headerTimezone)
                  ? headerTimezone
                  : getBrowserTimezone();
              // write default settings against the user
              await dbRpc.insertUserSettings({
                ...defaultUserSettings,
                timezone,
              });
            }
          }
        }
      }),
    },
    database: drizzleAdapter(db, { provider: 'pg' }),
    secondaryStorage: {
      get: async (key: string) => {
        const value = await redis.get(key);
        return value;
      },
      set: async (key: string, value: string, ttl?: number) => {
        if (ttl) {
          await redis.set(key, value, 'EX', ttl);
        } else {
          await redis.set(key, value);
        }
      },
      delete: async (key: string) => {
        await redis.del(key);
      },
    },
    advanced: {
      ipAddress: {
        disableIpTracking: true,
      },
      cookiePrefix: env.NODE_ENV === 'development' ? 'better-auth-dev' : 'better-auth',
      crossSubDomainCookies: {
        enabled: true,
        domain: env.COOKIE_DOMAIN,
      },
    },
    baseURL: env.VITE_PUBLIC_BACKEND_URL,
    trustedOrigins: [
      'https://app.0.email',
      'https://sapi.0.email',
      'https://staging.0.email',
      'https://0.email',
      'http://localhost:3000',
      // Add configured origins from environment
      ...(env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',').map((o) => o.trim()) || []),
    ],
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * 60 * 24 * 30, // 30 days
      },
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24 * 3, // 3 days (every 3 days the session expiration is updated)
    },
    socialProviders: getSocialProviders(env as unknown as Record<string, string>),
    account: {
      accountLinking: {
        enabled: true,
        allowDifferentEmails: true,
        trustedProviders: ['google', 'microsoft'],
      },
    },
    onAPIError: {
      onError: (error) => {
        console.error('API Error', error);
      },
      errorURL: `${env.VITE_PUBLIC_APP_URL}/login`,
      throw: true,
    },
  } satisfies BetterAuthOptions);
}

export type StandaloneAuth = ReturnType<typeof createStandaloneAuth>;
