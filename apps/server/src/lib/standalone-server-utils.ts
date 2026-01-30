/**
 * Standalone Server Utilities
 *
 * Provides standalone versions of server utilities that work without
 * Cloudflare Durable Objects. These utilities are used by tRPC routers
 * and other server-side code.
 */

import { getContext } from 'hono/context-storage';
import { connection } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { DB } from '../db';
import type { HonoContext } from '../ctx';
import { StandaloneDbRpc, createStandaloneDbRpc } from './standalone-db-rpc';
import { createDriver } from './driver';

// Module-level state for standalone mode
let _standaloneDb: DB | null = null;

/**
 * Initialize the standalone database connection
 * Must be called before using standalone server utilities
 */
export function initStandaloneDb(db: DB): void {
  _standaloneDb = db;
}

/**
 * Get the standalone database connection
 */
export function getStandaloneDb(): DB {
  if (!_standaloneDb) {
    throw new Error('Standalone database not initialized. Call initStandaloneDb() first.');
  }
  return _standaloneDb;
}

/**
 * Check if standalone database is initialized
 */
export function isStandaloneDbInitialized(): boolean {
  return _standaloneDb !== null;
}

/**
 * Get a database RPC instance for the given user
 *
 * Standalone version of getZeroDB() from server-utils.ts
 * Returns a StandaloneDbRpc instance instead of a Durable Object stub
 */
export function getStandaloneZeroDB(userId: string): StandaloneDbRpc {
  const db = getStandaloneDb();
  return createStandaloneDbRpc(db, userId);
}

/**
 * Get the active connection for the current session user
 *
 * Standalone version of getActiveConnection() from server-utils.ts
 * Uses direct drizzle queries instead of Durable Objects
 */
export async function getStandaloneActiveConnection() {
  const c = getContext<HonoContext>();
  const { sessionUser, auth } = c.var;

  if (!sessionUser) {
    throw new Error('Session Not Found');
  }

  const db = getStandaloneDb();
  const dbRpc = createStandaloneDbRpc(db, sessionUser.id);
  const userData = await dbRpc.findUser();

  // If user has a default connection, try to use it
  if (userData?.defaultConnectionId) {
    const activeConnection = await dbRpc.findUserConnection(userData.defaultConnectionId);
    if (activeConnection) return activeConnection;
  }

  // Fall back to first available connection
  const firstConnection = await dbRpc.findFirstConnection();
  if (!firstConnection) {
    try {
      if (auth) {
        await auth.api.revokeSession({ headers: c.req.raw.headers });
        await auth.api.signOut({ headers: c.req.raw.headers });
      }
    } catch (err) {
      console.warn(`[getStandaloneActiveConnection] Session cleanup failed for user ${sessionUser.id}:`, err);
    }
    console.error(`No connections found for user ${sessionUser.id}`);
    throw new Error('No connections found for user');
  }

  return firstConnection;
}

/**
 * Convert a connection to a mail driver
 *
 * Same implementation as connectionToDriver() from server-utils.ts
 * Works without modification in standalone mode
 */
export function connectionToDriver(activeConnection: typeof connection.$inferSelect) {
  if (!activeConnection.accessToken || !activeConnection.refreshToken) {
    throw new Error(`Invalid connection ${JSON.stringify(activeConnection?.id)}`);
  }

  return createDriver(activeConnection.providerId, {
    auth: {
      userId: activeConnection.userId,
      accessToken: activeConnection.accessToken,
      refreshToken: activeConnection.refreshToken,
      email: activeConnection.email,
    },
  });
}

/**
 * Verify a Google ID token
 *
 * Same implementation as verifyToken() from server-utils.ts
 */
export async function verifyToken(token: string): Promise<boolean> {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to verify token: ${await response.text()}`);
  }

  const data = (await response.json()) as unknown;
  return !!data;
}

/**
 * Reset a connection by clearing its tokens
 *
 * Standalone version that uses direct drizzle queries
 */
export async function resetConnection(connectionId: string): Promise<void> {
  const db = getStandaloneDb();
  await db
    .update(connection)
    .set({
      accessToken: null,
      refreshToken: null,
    })
    .where(eq(connection.id, connectionId));
}

/**
 * Type for the standalone server utilities context
 */
export interface StandaloneServerContext {
  db: DB;
  getZeroDB: (userId: string) => StandaloneDbRpc;
  getActiveConnection: () => Promise<typeof connection.$inferSelect>;
}

/**
 * Create a standalone server context
 *
 * This is useful for passing to route handlers that need access to
 * standalone utilities
 */
export function createStandaloneServerContext(db: DB): StandaloneServerContext {
  // Initialize the module-level db
  initStandaloneDb(db);

  return {
    db,
    getZeroDB: getStandaloneZeroDB,
    getActiveConnection: getStandaloneActiveConnection,
  };
}
