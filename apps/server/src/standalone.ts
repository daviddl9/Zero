/**
 * Standalone Server Entry Point
 *
 * A Node.js-native server that runs Zero Email without Cloudflare Workers.
 * Uses Hono for HTTP, BullMQ for job processing, and PostgreSQL/Redis directly.
 *
 * Run with: pnpm start:standalone
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { contextStorage } from 'hono/context-storage';
import { Redis } from 'ioredis';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { HonoAdapter } from '@bull-board/hono';
import { trpcServer } from '@hono/trpc-server';
import { createLocalJWKSet, jwtVerify } from 'jose';
import { EProviders } from './types';
import { initTracing } from './lib/tracing';

// Job Queue
import {
  initializeJobQueue,
  shutdownJobQueue,
  registerProcessor,
  createUnifiedWorker,
  getAllQueues,
  JOB_NAMES,
} from './lib/job-queue';
import { createSyncThreadsProcessor } from './lib/job-queue/jobs/sync-threads.job';
import { createSyncCoordinatorProcessor } from './lib/job-queue/jobs/sync-coordinator.job';
import { createSendEmailProcessor } from './lib/job-queue/jobs/send-email.job';
import { createScheduledEmailsProcessor } from './lib/job-queue/jobs/scheduled-emails.job';
import { createSubscriptionRenewalProcessor } from './lib/job-queue/jobs/subscription-renewal.job';
import { createCleanupWorkflowExecutionsProcessor } from './lib/job-queue/jobs/cleanup-workflow-executions.job';
import { createPollNewEmailsProcessor } from './lib/job-queue/jobs/poll-new-emails.job';

// Self-hosted infrastructure
import {
  KVStoreFactory,
  DurableStorageFactory,
  S3ObjectStore,
  parseS3Config,
  type ObjectStoreConfig,
} from './lib/self-hosted';
import {
  createThreadStorage,
  setGlobalThreadStorage,
  type IThreadStorage,
} from './lib/thread-storage';

// Database schema
import * as schema from './db/schema';

// Standalone modules
import { standaloneEnv } from './lib/standalone-env';
import { createStandaloneAuth, type StandaloneAuth } from './lib/standalone-auth';
import {
  initStandaloneDb,
  getStandaloneZeroDB,
} from './lib/standalone-server-utils';

// Workflow engine imports
import {
  WorkflowTriggerService,
  createWorkflowExecutor,
  type SyncedThreadData,
  type ActionContext,
} from './lib/workflow-engine';
import { createDriver } from './lib/driver';

// Routes
import { publicRouter } from './routes/auth';
import { autumnApi } from './routes/autumn';
import { aiRouter } from './routes/ai';
import { attachmentsRouter } from './routes/attachments';
import { appRouter } from './trpc';

// Types
import type { HonoVariables, SessionUser } from './ctx';

// Type definitions
interface StandaloneConfig {
  databaseUrl: string;
  redisHost: string;
  redisPort: number;
  redisPassword?: string;
  port: number;
  s3Config: ObjectStoreConfig | null;
}

// Extended Hono context for standalone
type StandaloneHonoContext = {
  Variables: HonoVariables & {
    standaloneAuth: StandaloneAuth;
  };
};

/**
 * Parse environment configuration
 */
function getConfig(): StandaloneConfig {
  return {
    databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/zerodotemail',
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
    redisPassword: process.env.REDIS_PASSWORD,
    port: parseInt(process.env.PORT || '8787', 10),
    s3Config: parseS3Config(),
  };
}

/**
 * Initialize PostgreSQL connection
 */
function initializeDatabase(connectionString: string) {
  const client = postgres(connectionString);
  const db = drizzle(client, { schema });
  return { db, client };
}

/**
 * Initialize Redis connection
 */
function initializeRedis(host: string, port: number, password?: string): Redis {
  const redis = new Redis({
    host,
    port,
    password,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      if (times > 10) {
        console.error('[Standalone] Redis connection failed after 10 retries');
        return null;
      }
      return Math.min(times * 200, 5000);
    },
  });

  redis.on('error', (err) => {
    console.error('[Standalone] Redis error:', err.message);
  });

  redis.on('connect', () => {
    console.log('[Standalone] Redis connected');
  });

  return redis;
}

/**
 * Main standalone server entry point
 */
async function main() {
  console.log('[Standalone] Starting Zero Email server...');
  const config = getConfig();
  const env = standaloneEnv();

  // Initialize database
  console.log('[Standalone] Connecting to PostgreSQL...');
  const { db, client: pgClient } = initializeDatabase(config.databaseUrl);

  // Initialize standalone database for server utilities
  initStandaloneDb(db);

  // Initialize Redis
  console.log('[Standalone] Connecting to Redis...');
  const redis = initializeRedis(config.redisHost, config.redisPort, config.redisPassword);

  // Initialize KV stores
  const kvFactory = new KVStoreFactory(redis);
  const kvStores = kvFactory.createDefaultStores();

  // Initialize S3/MinIO object storage for thread data
  let objectStore: S3ObjectStore | null = null;
  let threadStorage: IThreadStorage | null = null;

  if (config.s3Config) {
    console.log('[Standalone] Connecting to S3/MinIO...');
    objectStore = new S3ObjectStore(config.s3Config);

    // Ensure the bucket exists
    try {
      await objectStore.ensureBucket();
      console.log(`[Standalone] S3/MinIO connected, bucket: ${config.s3Config.bucket}`);

      // Create and set global thread storage
      threadStorage = createThreadStorage({ objectStore });
      setGlobalThreadStorage(threadStorage);
      console.log('[Standalone] Thread storage initialized with S3/MinIO');
    } catch (error) {
      console.error('[Standalone] Failed to connect to S3/MinIO:', error);
      console.warn('[Standalone] Thread storage will not be available');
    }
  } else {
    console.warn('[Standalone] S3/MinIO not configured - thread storage disabled');
    console.warn('[Standalone] Set S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET to enable');
  }

  // Initialize Durable Storage
  const durableStorageFactory = new DurableStorageFactory(
    {
      query: async <T>(sql: string, params?: unknown[]) => {
        const result = await pgClient.unsafe(sql, params as never[]);
        return { rows: result as T[] };
      },
    },
    redis,
  );

  // Initialize durable storage schema
  await durableStorageFactory.initialize();

  // Initialize job queue
  console.log('[Standalone] Initializing job queue...');
  await initializeJobQueue({
    redisHost: config.redisHost,
    redisPort: config.redisPort,
    redisPassword: config.redisPassword,
    startScheduler: true,
  });

  // Register job processors with dependencies
  const jobDependencies = createJobDependencies(db, kvStores, redis);
  registerJobProcessors(jobDependencies);

  // Start workers
  console.log('[Standalone] Starting workers...');
  const workers = createUnifiedWorker({ concurrency: 2 });
  console.log(`[Standalone] Started ${workers.length} workers`);

  // Create standalone auth
  console.log('[Standalone] Initializing authentication...');
  const auth = createStandaloneAuth(db, redis);

  // Create Hono app with context storage
  const app = new Hono<StandaloneHonoContext>();

  // Context storage middleware (must be first)
  app.use(contextStorage());

  // CORS
  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin) return null;
        let hostname: string;
        try {
          hostname = new URL(origin).hostname;
        } catch {
          return null;
        }
        const cookieDomain = env.COOKIE_DOMAIN;
        if (!cookieDomain) return origin; // Allow all in development
        if (hostname === cookieDomain || hostname.endsWith('.' + cookieDomain)) {
          return origin;
        }
        // Also allow configured CORS origins
        const corsOrigin = process.env.CORS_ORIGIN;
        if (corsOrigin === '*' || corsOrigin === origin) {
          return origin;
        }
        return null;
      },
      credentials: true,
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['X-Zero-Redirect'],
    }),
  );

  // Authentication middleware
  app.use('*', async (c, next) => {
    // Store auth instance in context
    c.set('auth', auth as unknown as HonoVariables['auth']);
    c.set('standaloneAuth', auth);

    // Get session from cookies
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    c.set('sessionUser', session?.user as SessionUser | undefined);

    // Handle JWT token authentication (for API clients)
    if (c.req.header('Authorization') && !session?.user) {
      const token = c.req.header('Authorization')?.split(' ')[1];

      if (token) {
        try {
          const localJwks = await auth.api.getJwks();
          const jwks = createLocalJWKSet(localJwks);

          const { payload } = await jwtVerify(token, jwks);
          const userId = payload.sub;

          if (userId) {
            const dbRpc = getStandaloneZeroDB(userId);
            const user = await dbRpc.findUser();
            c.set('sessionUser', user as SessionUser | undefined);
          }
        } catch (error) {
          console.warn('[Standalone] JWT verification failed:', error);
        }
      }
    }

    await next();

    // Cleanup
    c.set('sessionUser', undefined);
    c.set('auth', undefined as unknown as HonoVariables['auth']);
  });

  // Health check
  app.get('/health', async (c) => {
    const health: Record<string, unknown> = {
      status: 'ok',
      mode: 'standalone',
      timestamp: new Date().toISOString(),
      services: {
        redis: 'unknown',
        database: 'unknown',
        objectStorage: objectStore ? 'unknown' : 'disabled',
      },
    };

    // Check Redis
    try {
      await redis.ping();
      (health.services as Record<string, string>).redis = 'healthy';
    } catch {
      (health.services as Record<string, string>).redis = 'unhealthy';
      health.status = 'degraded';
    }

    // Check S3/MinIO if configured
    if (objectStore) {
      try {
        await objectStore.exists('__health_check__');
        (health.services as Record<string, string>).objectStorage = 'healthy';
      } catch {
        (health.services as Record<string, string>).objectStorage = 'unhealthy';
        health.status = 'degraded';
      }
    }

    return c.json(health);
  });

  // Sentry Tunnel
  const SENTRY_HOST = 'o4509328786915328.ingest.us.sentry.io';
  const SENTRY_PROJECT_IDS = new Set(['4509328795303936']);

  app.post('/monitoring/sentry', async (c) => {
    try {
      const envelopeBytes = await c.req.arrayBuffer();
      const envelope = new TextDecoder().decode(envelopeBytes);
      const piece = envelope.split('\n')[0];
      const header = JSON.parse(piece);
      const dsn = new URL(header['dsn']);
      const project_id = dsn.pathname?.replace('/', '');

      if (dsn.hostname !== SENTRY_HOST) {
        throw new Error(`Invalid sentry hostname: ${dsn.hostname}`);
      }

      if (!project_id || !SENTRY_PROJECT_IDS.has(project_id)) {
        throw new Error(`Invalid sentry project id: ${project_id}`);
      }

      const upstream_sentry_url = `https://${SENTRY_HOST}/api/${project_id}/envelope/`;
      await fetch(upstream_sentry_url, {
        method: 'POST',
        body: envelopeBytes,
      });

      return c.json({}, { status: 200 });
    } catch (e) {
      console.error('[Standalone] Error tunneling to sentry', e);
      return c.json({ error: 'error tunneling to sentry' }, { status: 500 });
    }
  });

  // Google Pub/Sub Notification Webhook (Alternative path for compatibility)
  app.post('/a8n/notify/:providerId', async (c) => {
    const tracer = initTracing();
    const span = tracer.startSpan('a8n_notify', {
      attributes: {
        'provider.id': c.req.param('providerId'),
        'notification.type': 'email_notification',
        'http.method': c.req.method,
        'http.url': c.req.url,
      },
    });

    try {
      if (!c.req.header('Authorization')) {
        span.setAttributes({ 'auth.status': 'missing' });
        return c.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const providerId = c.req.param('providerId');
      if (providerId === EProviders.google) {
        const body = await c.req.json<{ historyId: string }>();
        const subHeader = c.req.header('x-goog-pubsub-subscription-name');

        span.setAttributes({
          'history.id': body.historyId,
          'subscription.name': subHeader || 'missing',
        });

        if (!subHeader) {
          console.log('[Standalone] [GOOGLE] no subscription header', body);
          span.setAttributes({ 'error.type': 'missing_subscription_header' });
          return c.json({}, { status: 200 });
        }
        
        // In standalone, we skip JWT verifyToken check as it's designed for CF Workers KV
        // Instead we rely on the subscription name and history ID structure
        // Or implement a standalone verifyToken if needed (TODO)
        
        const { addJob } = await import('./lib/job-queue');
        await addJob(JOB_NAMES.SYNC_COORDINATOR, {
          userId: '', // Will be resolved by subscription name in the job
          connectionId: '', 
          triggerType: 'pubsub',
          historyId: body.historyId,
          subscriptionName: subHeader,
        });
        
        span.setAttributes({ 'queue.message_sent': true });
        return c.json({ message: 'OK' }, { status: 200 });
      }
      return c.json({ message: 'OK' }, { status: 200 });
    } catch (error) {
      console.error('[Standalone] Error processing a8n notify:', error);
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message });
      throw error;
    } finally {
      span.end();
    }
  });

  // Root redirect
  app.get('/', (c) => c.redirect(env.VITE_PUBLIC_APP_URL));

  // Bull Board admin UI (optional)
  try {
    const serverAdapter = new HonoAdapter('/admin/queues');
    createBullBoard({
      queues: getAllQueues().map((q) => new BullMQAdapter(q)),
      serverAdapter,
    });
    app.route('/admin/queues', serverAdapter.registerPlugin());
    console.log('[Standalone] Bull Board UI available at /admin/queues');
  } catch (error) {
    console.warn('[Standalone] Failed to initialize Bull Board UI:', error);
    console.warn('[Standalone] Job queue is still operational, but admin UI is unavailable');
  }

  // =========================================================================
  // API Routes
  // =========================================================================
  // Note: nginx strips /api prefix, so backend receives paths without /api
  // e.g., /api/public/providers becomes /public/providers

  // AI routes
  app.route('/ai', aiRouter);

  // Attachment proxy routes (inline images loaded lazily by the browser)
  app.route('/attachments', attachmentsRouter);

  // Autumn (billing) routes
  app.route('/autumn', autumnApi);

  // Public routes (providers list)
  app.route('/public', publicRouter);

  // Auth routes (better-auth handler)
  app.on(['GET', 'POST', 'OPTIONS'], '/auth/*', (c) => {
    return auth.handler(c.req.raw);
  });

  // tRPC routes
  app.use(
    '/trpc/*',
    trpcServer({
      endpoint: '/trpc',
      router: appRouter,
      createContext: (_, c) => {
        return {
          c,
          sessionUser: c.var['sessionUser'],
          auth: c.var['auth'],
        };
      },
      allowMethodOverride: true,
      onError: (opts) => {
        console.error('[Standalone] tRPC error:', opts.error);
      },
    }),
  );

  // =========================================================================
  // Job Queue Routes
  // =========================================================================

  // Pub/Sub webhook endpoint (for Gmail push notifications)
  app.post('/api/google/pubsub', async (c) => {
    try {
      const body = await c.req.json();
      const message = body.message;

      if (!message?.data) {
        return c.json({ error: 'Invalid message format' }, 400);
      }

      const decoded = JSON.parse(Buffer.from(message.data, 'base64').toString('utf-8'));
      const { emailAddress, historyId } = decoded;

      console.log(`[Standalone] Received pub/sub notification for ${emailAddress}, historyId: ${historyId}`);

      const subscriptionName = message.attributes?.subscription || body.subscription;

      if (!subscriptionName) {
        console.warn('[Standalone] No subscription name in pub/sub message');
        return c.json({ message: 'OK' }, 200);
      }

      const { addJob } = await import('./lib/job-queue');
      await addJob(JOB_NAMES.SYNC_COORDINATOR, {
        userId: '',
        connectionId: '',
        triggerType: 'pubsub',
        historyId,
      });

      return c.json({ message: 'OK' }, 200);
    } catch (error) {
      console.error('[Standalone] Error processing pub/sub:', error);
      return c.json({ message: 'OK' }, 200);
    }
  });

  // Scheduled jobs trigger endpoint
  app.post('/api/cron/trigger', async (c) => {
    const jobName = c.req.query('job');

    if (!jobName) {
      return c.json({ error: 'Missing job parameter' }, 400);
    }

    try {
      const { addJob } = await import('./lib/job-queue');

      switch (jobName) {
        case 'scheduled-emails':
          await addJob(JOB_NAMES.PROCESS_SCHEDULED_EMAILS, {
            batchSize: 50,
            windowHours: 12,
          });
          break;
        case 'cleanup':
          await addJob(JOB_NAMES.CLEANUP_WORKFLOW_EXECUTIONS, {
            retentionDays: 30,
          });
          break;
        default:
          return c.json({ error: `Unknown job: ${jobName}` }, 400);
      }

      return c.json({ message: 'Job queued', job: jobName });
    } catch (error) {
      console.error(`[Standalone] Error triggering ${jobName}:`, error);
      return c.json({ error: 'Failed to queue job' }, 500);
    }
  });

  // Queue stats endpoint
  app.get('/api/admin/queue-stats', async (c) => {
    const stats: Record<string, unknown> = {};

    for (const queue of getAllQueues()) {
      const counts = await queue.getJobCounts();
      stats[queue.name] = counts;
    }

    return c.json(stats);
  });

  // =========================================================================
  // Graceful Shutdown
  // =========================================================================

  const shutdown = async () => {
    console.log('[Standalone] Shutting down...');

    try {
      await shutdownJobQueue();
      await redis.quit();
      await pgClient.end();
      console.log('[Standalone] Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('[Standalone] Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // =========================================================================
  // Start Server
  // =========================================================================

  console.log(`[Standalone] Starting HTTP server on port ${config.port}...`);
  serve({
    fetch: app.fetch,
    port: config.port,
  });

  console.log(`[Standalone] Server running at http://localhost:${config.port}`);
  console.log(`[Standalone] Bull Board UI at http://localhost:${config.port}/admin/queues`);
  console.log('[Standalone] API routes available (nginx proxies /api/* to /*)');
  console.log('  - /auth/*      - Authentication (better-auth)');
  console.log('  - /trpc/*      - tRPC API');
  console.log('  - /public/*    - Public routes');
  console.log('  - /ai/*        - AI routes');
  console.log('  - /autumn/*    - Billing routes');
}

/**
 * Create job dependencies from database and KV stores
 */
function createJobDependencies(
  db: ReturnType<typeof drizzle>,
  kvStores: ReturnType<KVStoreFactory['createDefaultStores']>,
  redis: Redis,
) {
  const env = standaloneEnv();

  // Helper to create a mail driver from a connection
  const connectionToDriver = (connection: typeof schema.connection.$inferSelect) => {
    return createDriver(connection.providerId, {
      auth: {
        userId: connection.userId,
        accessToken: connection.accessToken || '',
        refreshToken: connection.refreshToken || '',
        email: connection.email,
      },
    });
  };

  return {
    // Connection helpers
    getConnection: async (connectionId: string) => {
      const result = await db.query.connection.findFirst({
        where: (c, { eq }) => eq(c.id, connectionId),
      });
      return result || null;
    },

    // Get all active connections (for polling job)
    getAllConnections: async () => {
      const connections = await db.query.connection.findMany({
        where: (c, { isNotNull }) => isNotNull(c.accessToken),
      });
      return connections;
    },

    // Get driver from connection
    getDriver: (connection: typeof schema.connection.$inferSelect) => {
      if (!connection.accessToken || !connection.refreshToken) {
        console.warn(`[JobDeps] Connection ${connection.id} missing tokens`);
        return null;
      }
      return connectionToDriver(connection);
    },

    // Sync a single thread from the email provider
    syncThread: async (connectionId: string, threadId: string) => {
      const connection = await db.query.connection.findFirst({
        where: (c, { eq }) => eq(c.id, connectionId),
      });
      if (!connection || !connection.accessToken || !connection.refreshToken) {
        console.warn(`[JobDeps] Cannot sync thread: connection ${connectionId} not found or missing tokens`);
        return null;
      }

      const driver = connectionToDriver(connection);
      const threadData = await driver.get(threadId);

      if (!threadData || !threadData.latest) {
        return null;
      }

      return {
        sender: threadData.latest.sender?.email || '',
        receivedOn: threadData.latest.receivedOn,
        subject: threadData.latest.subject || '',
        tags: threadData.labels.map((label) => ({ id: label.id, name: label.name })),
        unread: threadData.hasUnread,
        body: threadData.latest.decodedBody || threadData.latest.body || '',
        decodedBody: threadData.latest.decodedBody,
      };
    },

    // List history changes from Gmail
    listHistory: async (connectionId: string, historyId: string) => {
      const connection = await db.query.connection.findFirst({
        where: (c, { eq }) => eq(c.id, connectionId),
      });
      if (!connection || !connection.accessToken || !connection.refreshToken) {
        console.warn(`[JobDeps] Cannot list history: connection ${connectionId} not found or missing tokens`);
        return { history: [] };
      }

      const driver = connectionToDriver(connection);
      const result = await driver.listHistory<{
        messagesAdded?: Array<{ message?: { threadId?: string; labelIds?: string[] } }>;
        labelsAdded?: Array<{ message?: { threadId?: string }; labelIds?: string[] }>;
        labelsRemoved?: Array<{ message?: { threadId?: string }; labelIds?: string[] }>;
      }>(historyId);

      return { history: result.history };
    },

    // Evaluate workflow triggers for a synced thread
    evaluateTriggers: async (
      connectionId: string,
      threadData: {
        id: string;
        subject: string;
        sender: string;
        labels: Array<{ id: string; name: string }>;
        receivedOn: string;
        unread: boolean;
        body: string;
      },
    ) => {
      const connection = await db.query.connection.findFirst({
        where: (c, { eq }) => eq(c.id, connectionId),
      });
      if (!connection) {
        console.warn(`[JobDeps] Cannot evaluate triggers: connection ${connectionId} not found`);
        return;
      }

      console.log(`[JobDeps] Evaluating workflow triggers for thread ${threadData.id}`);

      // Build the synced thread data format expected by WorkflowTriggerService
      const syncedThreadData: SyncedThreadData = {
        id: threadData.id,
        subject: threadData.subject,
        sender: {
          email: threadData.sender,
        },
        labels: threadData.labels,
        receivedOn: threadData.receivedOn,
        unread: threadData.unread,
        body: threadData.body,
      };

      // Use WorkflowTriggerService to evaluate and create execution records
      const triggerService = new WorkflowTriggerService(db as never);
      const result = await triggerService.evaluateAndTrigger(
        connection.userId,
        connectionId,
        syncedThreadData,
        'email_received',
      );

      if (result.triggeredWorkflows.length > 0) {
        console.log(`[JobDeps] Triggered ${result.triggeredWorkflows.length} workflows for thread ${threadData.id}`);

        // Execute each triggered workflow
        const driver = connectionToDriver(connection);
        for (const triggered of result.triggeredWorkflows) {
          console.log(`[JobDeps] Executing workflow ${triggered.workflowName} (${triggered.executionId})`);

          try {
            // Build action context for workflow execution
            const actionContext: ActionContext = {
              connectionId,
              triggerData: {
                threadId: threadData.id,
                subject: threadData.subject,
                sender: threadData.sender,
                labels: threadData.labels.map((l) => l.id),
                snippet: threadData.body,
                receivedAt: threadData.receivedOn,
              },
              modifyThread: async (tid, opts) => {
                console.log(`[WorkflowAction] modifyThread: thread=${tid} add=[${opts.addLabels}] remove=[${opts.removeLabels}]`);
                try {
                  await driver.modifyLabels([tid], opts);
                  console.log(`[WorkflowAction] modifyThread SUCCESS: thread=${tid}`);
                } catch (error) {
                  console.error(`[WorkflowAction] modifyThread FAILED: thread=${tid}`, error);
                  throw error;
                }
              },
              getLabels: async () => {
                const labels = await driver.getUserLabels();
                return labels.map((l) => ({ id: l.id, name: l.name }));
              },
              createDraft: async (opts) => {
                const result = await driver.createDraft({
                  to: opts.to.join(','),
                  subject: opts.subject,
                  message: opts.body,
                  threadId: opts.threadId || null,
                  headers: {},
                });
                return { id: result.id || '' };
              },
            };

            // Create and run the executor
            const executor = createWorkflowExecutor(
              db as never,
              actionContext,
              connection.userId,
              env as never,
            );

            const execResult = await executor.execute(triggered.executionId);

            if (execResult.success) {
              console.log(`[JobDeps] Workflow ${triggered.workflowName} completed successfully`);
            } else {
              console.error(`[JobDeps] Workflow ${triggered.workflowName} failed: ${execResult.error}`);
            }
          } catch (error) {
            console.error(`[JobDeps] Failed to execute workflow ${triggered.workflowName}:`, error);
          }
        }
      }

      if (result.errors.length > 0) {
        for (const err of result.errors) {
          console.error(`[JobDeps] Workflow trigger error for ${err.workflowId}: ${err.error}`);
        }
      }
    },

    // History ID management
    getHistoryId: async (connectionId: string) => {
      return await kvStores.gmail_history_id.get(connectionId);
    },
    setHistoryId: async (connectionId: string, historyId: string) => {
      await kvStores.gmail_history_id.put(connectionId, historyId);
    },

    // Locking
    acquireLock: async (key: string, ttlSeconds: number) => {
      const result = await redis.set(key, 'locked', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    },
    releaseLock: async (key: string) => {
      await redis.del(key);
    },

    // Email status
    updateEmailStatus: async (
      emailId: string,
      status: 'pending' | 'sending' | 'sent' | 'failed',
      error?: string,
    ) => {
      await kvStores.pending_emails_status.put(emailId, JSON.stringify({ status, error }));
    },
    deleteEmailPayload: async (emailId: string) => {
      await kvStores.pending_emails_payload.delete(emailId);
    },

    // Scheduled emails
    getScheduledEmails: async (params: { beforeTime: Date; limit: number }) => {
      const result = await kvStores.scheduled_emails.list({ limit: params.limit });
      const emails = [];
      for (const key of result.keys) {
        const data = await kvStores.scheduled_emails.get(key.name, { type: 'json' });
        if (data) {
          emails.push(data as never);
        }
      }
      return emails;
    },
    markEmailAsQueued: async (emailId: string) => {
      await kvStores.scheduled_emails.delete(emailId);
    },

    // Subscription age
    getSubscriptionAge: async (connectionId: string) => {
      const value = await kvStores.gmail_sub_age.get(connectionId);
      return value ? parseInt(value, 10) : null;
    },
    setSubscriptionAge: async (connectionId: string, timestamp: number) => {
      await kvStores.gmail_sub_age.put(connectionId, timestamp.toString());
    },

    // Cleanup
    deleteOldExecutions: async (olderThan: Date) => {
      const result = await db.delete(schema.workflowExecution)
        .where((row, { lt }) => lt(row.createdAt, olderThan))
        .returning();
      return result.length;
    },
  };
}

/**
 * Register all job processors with their dependencies
 */
function registerJobProcessors(deps: ReturnType<typeof createJobDependencies>) {
  // Sync threads processor
  registerProcessor(
    JOB_NAMES.SYNC_THREADS,
    createSyncThreadsProcessor({
      getConnection: deps.getConnection as never,
      getDriver: deps.getDriver as never,
      syncThread: deps.syncThread,
      storeThread: async () => {
        // Thread storage is handled by S3/MinIO in standalone mode
        // For now, we skip local storage and rely on API fetches
      },
      evaluateTriggers: deps.evaluateTriggers,
      reloadFolder: async () => {
        // Folder reload is a no-op in standalone mode (no local cache)
      },
    }),
  );

  // Sync coordinator processor
  registerProcessor(
    JOB_NAMES.SYNC_COORDINATOR,
    createSyncCoordinatorProcessor({
      getHistoryId: deps.getHistoryId,
      setHistoryId: deps.setHistoryId,
      acquireLock: deps.acquireLock,
      releaseLock: deps.releaseLock,
      listHistory: deps.listHistory,
      syncThread: async (connectionId: string, threadId: string) => {
        // Sync thread and evaluate triggers
        const threadData = await deps.syncThread(connectionId, threadId);
        if (threadData) {
          // Evaluate workflow triggers for the synced thread
          await deps.evaluateTriggers(connectionId, {
            id: threadId,
            subject: threadData.subject,
            sender: threadData.sender,
            labels: threadData.tags,
            receivedOn: threadData.receivedOn,
            unread: threadData.unread,
            body: threadData.body || '',
          });
          return { success: true };
        }
        return { success: false };
      },
      modifyLabels: async (connectionId: string, threadId: string, addLabels: string[], removeLabels: string[]) => {
        const connection = await deps.getConnection(connectionId);
        if (!connection || !connection.accessToken || !connection.refreshToken) {
          console.warn(`[JobDeps] Cannot modify labels: connection ${connectionId} not found`);
          return;
        }
        const driver = deps.getDriver(connection);
        if (driver) {
          await driver.modifyLabels([threadId], { addLabels, removeLabels });
        }
      },
      reloadFolder: async () => {
        // Folder reload is a no-op in standalone mode (no local cache)
      },
    }),
  );

  // Send email processor
  registerProcessor(
    JOB_NAMES.SEND_EMAIL,
    createSendEmailProcessor({
      getConnection: deps.getConnection as never,
      getDriver: deps.getDriver as never,
      updateEmailStatus: deps.updateEmailStatus,
      deleteEmailPayload: deps.deleteEmailPayload,
    }),
  );

  // Scheduled emails processor
  registerProcessor(
    JOB_NAMES.PROCESS_SCHEDULED_EMAILS,
    createScheduledEmailsProcessor({
      getScheduledEmails: deps.getScheduledEmails as never,
      markEmailAsQueued: deps.markEmailAsQueued,
    }),
  );

  // Subscription renewal processor
  registerProcessor(
    JOB_NAMES.SUBSCRIPTION_RENEWAL,
    createSubscriptionRenewalProcessor({
      getConnection: deps.getConnection as never,
      watchMailbox: async () => ({ historyId: '', expiration: '' }),
      getSubscriptionAge: deps.getSubscriptionAge,
      setSubscriptionAge: deps.setSubscriptionAge,
    }),
  );

  // Cleanup processor
  registerProcessor(
    JOB_NAMES.CLEANUP_WORKFLOW_EXECUTIONS,
    createCleanupWorkflowExecutionsProcessor({
      deleteOldExecutions: deps.deleteOldExecutions,
    }),
  );

  // Poll new emails processor (standalone mode - no push notifications)
  registerProcessor(
    JOB_NAMES.POLL_NEW_EMAILS,
    createPollNewEmailsProcessor({
      getAllConnections: deps.getAllConnections,
      getHistoryId: deps.getHistoryId,
      setHistoryId: deps.setHistoryId,
      getDriver: deps.getDriver as never,
      syncThread: deps.syncThread,
      evaluateTriggers: deps.evaluateTriggers,
    }),
  );

  console.log('[Standalone] Registered all job processors');
}

// Run the server
main().catch((error) => {
  console.error('[Standalone] Fatal error:', error);
  process.exit(1);
});
