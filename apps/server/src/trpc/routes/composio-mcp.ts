/* eslint-disable */
import { createRateLimiterMiddleware, privateProcedure, router } from '../trpc';
import { mcpRegistry, type MCPConnection } from '../../lib/mcp-providers';
import { Ratelimit } from '@upstash/ratelimit';
import { TRPCError } from '@trpc/server';
import { env } from '../../env';
import { z } from 'zod';

export const composioConnections = router({
    toolkits: privateProcedure
        .use(
            createRateLimiterMiddleware({
                limiter: Ratelimit.slidingWindow(60, '1m'),
                generatePrefix: ({ sessionUser }) => `ratelimit:composio-toolkits-${sessionUser?.id}`,
            }),
        )
        .query(async () => {
            await mcpRegistry.initialize(env);
            const provider = mcpRegistry.getProvider('composio');

            if (!provider) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Composio provider not configured',
                });
            }

            const composioProvider = provider as any;
            const toolkits = await composioProvider.listToolkits();
            return { toolkits };
        }),

    list: privateProcedure
        .use(
            createRateLimiterMiddleware({
                limiter: Ratelimit.slidingWindow(60, '1m'),
                generatePrefix: ({ sessionUser }) => `ratelimit:composio-connections-${sessionUser?.id}`,
            }),
        )
        .query(async ({ ctx }) => {
            await mcpRegistry.initialize(env);
            const provider = mcpRegistry.getProvider('composio');

            if (!provider) {
                return { connections: [] };
            }

            const connections = (await provider.listConnections?.(ctx.sessionUser.id)) || [];

            return { connections };
        }),

    getAuthUrl: privateProcedure
        .input(z.object({ toolkit: z.string() }))
        .use(
            createRateLimiterMiddleware({
                limiter: Ratelimit.slidingWindow(30, '1m'),
                generatePrefix: ({ sessionUser }) => `ratelimit:composio-auth-${sessionUser?.id}`,
            }),
        )
        .mutation(async ({ input, ctx }) => {
            await mcpRegistry.initialize(env);
            const provider = mcpRegistry.getProvider('composio');

            if (!provider || !provider.getAuthUrl) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Composio provider not configured',
                });
            }

            const authResponse = await provider.getAuthUrl(ctx.sessionUser.id, input.toolkit);

            if (authResponse.status === 'completed') {
                return { status: 'completed' };
            }

            return {
                authUrl: authResponse.url || '',
                authId: authResponse.authId,
            };
        }),

    createConnection: privateProcedure
        .input(
            z.object({
                toolkit: z.string(),
                authId: z.string(),
            }),
        )
        .use(
            createRateLimiterMiddleware({
                limiter: Ratelimit.slidingWindow(30, '1m'),
                generatePrefix: ({ sessionUser }) => `ratelimit:composio-create-${sessionUser?.id}`,
            }),
        )
        .mutation(async ({ input, ctx }) => {
            await mcpRegistry.initialize(env);
            const provider = mcpRegistry.getProvider('composio');

            if (!provider || !provider.verifyAuth) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Composio provider not configured',
                });
            }

            const isValid = await provider.verifyAuth(input.authId);

            if (!isValid) {
                throw new TRPCError({
                    code: 'UNAUTHORIZED',
                    message: 'Authorization not completed or failed',
                });
            }

            return {
                success: true,
                connection: {
                    id: `${ctx.sessionUser.id}-${input.toolkit}`,
                    userId: ctx.sessionUser.id,
                    toolkit: input.toolkit,
                    status: 'connected' as const,
                    authorizedAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                },
            };
        }),

    revoke: privateProcedure
        .input(z.object({ connectionId: z.string() }))
        .use(
            createRateLimiterMiddleware({
                limiter: Ratelimit.slidingWindow(30, '1m'),
                generatePrefix: ({ sessionUser }) => `ratelimit:composio-revoke-${sessionUser?.id}`,
            }),
        )
        .mutation(async ({ input, ctx }) => {
            await mcpRegistry.initialize(env);
            const provider = mcpRegistry.getProvider('composio');

            if (!provider || !provider.revokeConnection) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Composio provider not configured',
                });
            }

            await provider.revokeConnection(input.connectionId, ctx.sessionUser.id);
            return { success: true };
        }),

    getAvailableTools: privateProcedure
        .use(
            createRateLimiterMiddleware({
                limiter: Ratelimit.slidingWindow(60, '1m'),
                generatePrefix: ({ sessionUser }) => `ratelimit:composio-available-tools-${sessionUser?.id}`,
            }),
        )
        .query(async ({ ctx }) => {
            await mcpRegistry.initialize(env);
            const provider = mcpRegistry.getProvider('composio');

            if (!provider) {
                return { tools: [] };
            }

            const tools = await provider.listTools(ctx.sessionUser.id);

            const formattedTools = tools.map((tool) => ({
                toolkit: tool.category || 'unknown',
                toolName: tool.name,
                description: tool.description,
                parameters: tool.inputSchema,
            }));

            console.log(`[Composio] Found ${formattedTools.length} tools for user ${ctx.sessionUser.id}`);

            return { tools: formattedTools };
        }),
});

