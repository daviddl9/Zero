import { createRateLimiterMiddleware, privateProcedure, router } from '../trpc';
import { getZeroDB } from '../../lib/server-utils';
import { Ratelimit } from '@upstash/ratelimit';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

export const arcadeConnectionsRouter = router({
  checkAuthorization: privateProcedure
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(60, '1m'),
        generatePrefix: ({ sessionUser }) => `ratelimit:check-arcade-auth-${sessionUser?.id}`,
      }),
    )
    .input(z.object({ toolName: z.string() }))
    .query(async ({ ctx, input }) => {
      const { sessionUser } = ctx;
      const { toolName } = input;
      const env = ctx.c.env;

      if (!env.ARCADE_API_KEY) {
        return {
          needsAuth: false,
          error: 'Arcade API key not configured',
        };
      }

      const { getArcadeAuthHandler } = await import('../../lib/arcade-auth-handler');
      const authHandler = getArcadeAuthHandler(env.ARCADE_API_KEY);

      const authState = await authHandler.requiresAuth(toolName, sessionUser.id);

      return {
        needsAuth: authState.status === 'pending',
        authUrl: authState.authUrl,
        authId: authState.authId,
        status: authState.status,
      };
    }),

  waitForAuthorization: privateProcedure
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(20, '1m'),
        generatePrefix: ({ sessionUser }) => `ratelimit:wait-arcade-auth-${sessionUser?.id}`,
      }),
    )
    .input(z.object({ authId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { sessionUser } = ctx;
      const { authId } = input;
      const env = ctx.c.env;

      if (!env.ARCADE_API_KEY) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Arcade API key not configured',
        });
      }

      const { getArcadeAuthHandler } = await import('../../lib/arcade-auth-handler');
      const authHandler = getArcadeAuthHandler(env.ARCADE_API_KEY);

      const success = await authHandler.waitForAuthorization(authId, sessionUser.id);

      return { success };
    }),
  toolkits: privateProcedure
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(60, '1m'),
        generatePrefix: ({ sessionUser }) => `ratelimit:arcade-toolkits-${sessionUser?.id}`,
      }),
    )
    .query(async ({ ctx }) => {
      const env = ctx.c.env;

      if (!env.ARCADE_API_KEY) {
        return { toolkits: [] };
      }

      try {
        const toolkits = [
          {
            name: 'github',
            description: 'Manage repositories, issues, and pull requests',
            toolCount: 8,
          },
          { name: 'linear', description: 'Track issues and manage projects', toolCount: 7 },
          { name: 'stripe', description: 'Access payment and customer data', toolCount: 10 },
        ];

        return { toolkits };
      } catch (error) {
        console.error('Error initializing Arcade client:', error);
        return { toolkits: [] };
      }
    }),

  list: privateProcedure
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(60, '1m'),
        generatePrefix: ({ sessionUser }) => `ratelimit:list-arcade-connections-${sessionUser?.id}`,
      }),
    )
    .query(async ({ ctx }) => {
      const { sessionUser } = ctx;
      const db = await getZeroDB(sessionUser.id);

      const connections = await db.findManyArcadeConnections();

      return {
        connections: connections.map((connection) => ({
          id: connection.id,
          userId: connection.userId,
          toolkit: connection.toolkit,
          status: connection.status,
          authorizedAt: connection.authorizedAt.toISOString(),
          createdAt: connection.createdAt.toISOString(),
          updatedAt: connection.updatedAt.toISOString(),
        })),
      };
    }),

  getAuthUrl: privateProcedure
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(20, '1m'),
        generatePrefix: ({ sessionUser }) => `ratelimit:arcade-auth-url-${sessionUser?.id}`,
      }),
    )
    .input(z.object({ toolkit: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { sessionUser } = ctx;
      const { toolkit } = input;
      const env = ctx.c.env;

      if (!env.ARCADE_API_KEY) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Arcade API key not configured',
        });
      }

      // Use Arcade SDK to get the proper authorization URL
      const { getArcadeAuthHandler } = await import('../../lib/arcade-auth-handler');
      const authHandler = getArcadeAuthHandler(env.ARCADE_API_KEY);

      // Map toolkit names to proper Arcade tool names
      const toolkitMap: Record<string, string> = {
        gmail: 'Gmail.SendEmail', // Use a specific tool from the toolkit
        github: 'GitHub.CreateIssue',
        slack: 'Slack.SendMessage',
        notion: 'Notion.CreatePage',
        linear: 'Linear.CreateIssue',
        stripe: 'Stripe.CreateCustomer',
      };

      const toolName = toolkitMap[toolkit.toLowerCase()] || `${toolkit}.Default`;
      const authState = await authHandler.requiresAuth(toolName, sessionUser.id);

      if (!authState.authUrl || !authState.authId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to generate authorization URL',
        });
      }

      return {
        authUrl: authState.authUrl,
        authId: authState.authId,
      };
    }),

  // Create connection after successful authorization
  createConnection: privateProcedure
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(20, '1m'),
        generatePrefix: ({ sessionUser }) =>
          `ratelimit:arcade-create-connection-${sessionUser?.id}`,
      }),
    )
    .input(
      z.object({
        toolkit: z.string(),
        authId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { sessionUser } = ctx;
      const { toolkit, authId } = input;
      const env = ctx.c.env;

      if (!env.ARCADE_API_KEY) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Arcade API key not configured',
        });
      }

      // Check if authorization is complete
      const { getArcadeAuthHandler } = await import('../../lib/arcade-auth-handler');
      const authHandler = getArcadeAuthHandler(env.ARCADE_API_KEY);

      const success = await authHandler.waitForAuthorization(authId, sessionUser.id);

      if (!success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Authorization not completed',
        });
      }

      // Create the connection record
      const db = await getZeroDB(sessionUser.id);
      const connectionId = crypto.randomUUID();

      await db.createArcadeConnection({
        id: connectionId,
        toolkit,
        status: 'connected',
        accessToken: 'arcade-sdk-managed', // Token is managed by Arcade SDK
        refreshToken: null,
        expiresAt: null,
        authorizedAt: new Date(),
      });

      return { success: true, connectionId };
    }),

  revoke: privateProcedure
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(20, '1m'),
        generatePrefix: ({ sessionUser }) => `ratelimit:revoke-arcade-${sessionUser?.id}`,
      }),
    )
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { sessionUser } = ctx;
      const { id } = input;

      const db = await getZeroDB(sessionUser.id);

      const connection = await db.findArcadeConnection(id);
      if (!connection || connection.userId !== sessionUser.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found',
        });
      }

      await db.deleteArcadeConnection(id);

      return { success: true };
    }),

  handleCallback: privateProcedure
    .input(
      z.object({
        code: z.string(),
        state: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { sessionUser } = ctx;
      const { code, state } = input;

      const db = await getZeroDB(sessionUser.id);

      const authState = await db.verifyArcadeAuthState(state);
      if (!authState || authState.userId !== sessionUser.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid authorization state',
        });
      }

      const env = ctx.c.env;
      if (!env.ARCADE_CLIENT_ID || !env.ARCADE_CLIENT_SECRET) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Arcade credentials not configured',
        });
      }

      const tokenUrl = 'https://app.arcade.ai/oauth/token';
      const redirectUri = `${env.BETTER_AUTH_URL}/api/arcade/callback`;

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: env.ARCADE_CLIENT_ID,
          client_secret: env.ARCADE_CLIENT_SECRET,
        }),
      });

      if (!response.ok) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to exchange code for tokens',
        });
      }

      const tokens = (await response.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };

      const connectionId = crypto.randomUUID();
      await db.createArcadeConnection({
        id: connectionId,
        toolkit: authState.toolkit,
        status: 'connected',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
        authorizedAt: new Date(),
      });

      await db.deleteArcadeAuthState(state);

      return { success: true, connectionId };
    }),
});
