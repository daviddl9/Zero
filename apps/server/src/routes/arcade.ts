import { mcpRegistry } from '../lib/mcp-providers';
import type { HonoContext } from '../ctx';
import { createAuth } from '../lib/auth';
import { env } from '../env';
import { Hono } from 'hono';

export const arcadeRouter = new Hono<HonoContext>()
  .use('*', async (c, next) => {
    await mcpRegistry.initialize(env);
    await next();
  })
  .get('/verify-user', async (c) => {
    try {
      const flowId = c.req.query('flow_id');

      if (!flowId) {
        console.error('[Arcade Verify User] Missing flow_id parameter');
        return c.json({ error: 'Missing required parameter: flow_id' }, 400);
      }

      const auth = createAuth();
      const session = await auth.api.getSession({
        headers: c.req.raw.headers,
      });

      if (!session || !session.user) {
        console.error('[Arcade Verify User] No authenticated session found');
        return c.json({ error: 'Authentication required' }, 401);
      }

      const provider = mcpRegistry.getProvider('arcade');
      if (!provider) {
        console.error('[Arcade Verify User] Arcade provider not configured');
        return c.json({ error: 'Arcade integration not configured' }, 500);
      }

      try {
        const isValid = await provider.verifyAuth?.(session.user.id, flowId);

        console.log('[Arcade Verify User] Auth verification result', {
          userId: session.user.id,
          isValid,
        });

        if (isValid) {
          const toolkit = c.req.query('toolkit');
          const params = new URLSearchParams();
          params.set('arcade_auth_success', 'true');
          if (toolkit) {
            params.set('toolkit', toolkit);
          }
          params.set('auth_id', `${session.user.id}-${flowId}`);

          const redirectUrl = `${env.VITE_PUBLIC_APP_URL}/settings/connections?${params.toString()}`;
          return c.redirect(redirectUrl);
        } else {
          console.error('[Arcade Verify User] Authorization not completed');
          return c.redirect(
            `${env.VITE_PUBLIC_APP_URL}/settings/connections?error=arcade_auth_incomplete`,
          );
        }
      } catch (error) {
        console.error('[Arcade Verify User] Error confirming user with Arcade:', error);

        if (error && typeof error === 'object' && 'status' in error) {
          const statusCode = (error as { status: number }).status;
          const errorData = (error as { status: number; data?: unknown }).data;

          console.error('[Arcade Verify User] Arcade API error details:', {
            statusCode,
            errorData,
          });

          return c.redirect(
            `${env.VITE_PUBLIC_APP_URL}/settings/connections?error=arcade_verification_failed`,
          );
        }

        return c.redirect(
          `${env.VITE_PUBLIC_APP_URL}/settings/connections?error=arcade_auth_error`,
        );
      }
    } catch (error) {
      console.error('[Arcade Verify User] Unexpected error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  })
  .get('/callback', async (c) => {
    const success = c.req.query('success');
    const error = c.req.query('error');
    const toolkit = c.req.query('toolkit');

    if (error) {
      console.error('Arcade authorization error:', error);
      return c.redirect(`${env.VITE_PUBLIC_APP_URL}/settings/connections?error=arcade_auth_failed`);
    }

    const params = new URLSearchParams();
    if (success === 'true' && toolkit) {
      params.set('arcade_connected', toolkit);
    }

    return c.redirect(`${env.VITE_PUBLIC_APP_URL}/settings/connections?${params.toString()}`);
  });
