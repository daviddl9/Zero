import { WorkerEntrypoint, DurableObject } from 'cloudflare:workers';
import { type ZeroEnv } from './env';

interface IEmailSendBatch {
  emails: Array<{
    connectionId: string;
    to: string[];
    subject: string;
    body: string;
  }>;
}

interface ISubscribeBatch {
  subscriptions: Array<{
    connectionId: string;
    type: string;
  }>;
}

interface IThreadBatch {
  threads: Array<{
    connectionId: string;
    threadId: string;
  }>;
}

export class ZeroDB extends DurableObject {
  constructor(ctx: DurableObjectState, env: ZeroEnv) {
    super(ctx, env);
  }

  async updateConnection(_connectionId: string, _data: any) {
    return { success: true };
  }

  async getConnection(connectionId: string) {
    return { id: connectionId };
  }

  async getConnections() {
    return [];
  }

  async deleteConnection(_connectionId: string) {
    return { success: true };
  }

  async createConnection(_data: any) {
    return { id: 'new-connection' };
  }

  async getActiveConnection() {
    return { id: 'active-connection' };
  }

  async setActiveConnection(_connectionId: string) {
    return { success: true };
  }
}

export class ZeroAgent extends DurableObject {
  constructor(ctx: DurableObjectState, env: ZeroEnv) {
    super(ctx, env);
  }

  async processMessage(_message: any) {
    return { success: true };
  }
}

export class ZeroDriver extends DurableObject {
  constructor(ctx: DurableObjectState, env: ZeroEnv) {
    super(ctx, env);
  }

  async connect() {
    return { success: true };
  }
}

export class ShardRegistry extends DurableObject {
  constructor(ctx: DurableObjectState, env: ZeroEnv) {
    super(ctx, env);
  }

  async getShard(_key: string) {
    return { shard: 'default' };
  }
}

export default class WorkerService extends WorkerEntrypoint<ZeroEnv> {
  constructor(ctx: ExecutionContext, env: ZeroEnv) {
    super(ctx, env);
  }

  async getZeroAgent(connectionId: string) {
    const id = this.env.ZERO_AGENT.idFromName(connectionId);
    const stub = this.env.ZERO_AGENT.get(id);
    return stub;
  }

  async getZeroDB(userId: string) {
    const id = this.env.ZERO_DB.idFromName(userId);
    const stub = this.env.ZERO_DB.get(id);
    return stub;
  }

  async sendEmail(payload: IEmailSendBatch) {
    await this.env.send_email_queue.send(payload);
  }

  async sendSubscribe(payload: ISubscribeBatch) {
    await this.env.subscribe_queue.send(payload);
  }

  async sendThread(payload: IThreadBatch) {
    await this.env.thread_queue.send(payload);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname.startsWith('/internal/zero-db/')) {
      const userId = url.pathname.split('/').pop();
      try {
        const _db = await this.getZeroDB(userId!);
        return Response.json({ success: true, db: 'stub' });
      } catch (error) {
        console.error('Failed to get ZeroDB:', error);
        return Response.json({ error: 'Failed to get ZeroDB' }, { status: 500 });
      }
    }

    if (url.pathname.startsWith('/internal/zero-agent/')) {
      const connectionId = url.pathname.split('/').pop();
      try {
        const _agent = await this.getZeroAgent(connectionId!);
        return Response.json({ success: true, agent: 'stub' });
      } catch (error) {
        console.error('Failed to get ZeroAgent:', error);
        return Response.json({ error: 'Failed to get ZeroAgent' }, { status: 500 });
      }
    }

    if (url.pathname === '/internal/active-connection') {
      return Response.json({ id: 'active-connection' });
    }

    if (url.pathname === '/internal/verify-token' && request.method === 'POST') {
      try {
        const { token: _token } = await request.json() as { token: string };
        return Response.json({ valid: true });
      } catch (error) {
        console.error('Failed to verify token:', error);
        return Response.json({ error: 'Failed to verify token' }, { status: 500 });
      }
    }

    if (url.pathname.startsWith('/internal/connection-driver/')) {
      const connectionId = url.pathname.split('/').pop();
      return Response.json({ driver: 'stub', connectionId });
    }

    if (url.pathname.startsWith('/internal/socket-agent/')) {
      const connectionId = url.pathname.split('/').pop();
      return Response.json({ agent: 'stub', connectionId });
    }

    if (url.pathname === '/internal/resync-thread' && request.method === 'POST') {
      try {
        const { connectionId: _connectionId, threadId: _threadId } = await request.json() as { connectionId: string; threadId: string };
        return Response.json({ success: true });
      } catch (error) {
        console.error('Failed to resync thread:', error);
        return Response.json({ error: 'Failed to resync thread' }, { status: 500 });
      }
    }

    if (url.pathname.startsWith('/internal/redis/get/')) {
      const _key = url.pathname.split('/').pop();
      return Response.json({ value: null });
    }

    if (url.pathname === '/internal/redis/set' && request.method === 'POST') {
      try {
        const { key: _key, value: _value } = await request.json() as { key: string; value: any };
        return Response.json({ success: true });
      } catch (error) {
        console.error('Failed to set in Redis:', error);
        return Response.json({ error: 'Failed to set in Redis' }, { status: 500 });
      }
    }

    if (url.pathname.startsWith('/internal/redis/del/')) {
      const _key = url.pathname.split('/').pop();
      return Response.json({ success: true });
    }

    return new Response('Not Found', { status: 404 });
  }

  async queue(batch: MessageBatch<any>): Promise<void> {
    for (const message of batch.messages) {
      try {
        switch (batch.queue) {
          case 'send-email-queue': {
            const payload = message.body as IEmailSendBatch;
            console.log(`Processing send email batch with ${payload.emails.length} emails`);
            
            for (const email of payload.emails) {
              try {
                const _agent = await this.getZeroAgent(email.connectionId);
                console.log(`Successfully sent email for connection ${email.connectionId}`);
              } catch (error) {
                console.error(`Failed to send email for connection ${email.connectionId}:`, error);
                message.retry();
              }
            }
            break;
          }

          case 'subscribe-queue': {
            const payload = message.body as ISubscribeBatch;
            console.log(`Processing subscribe batch with ${payload.subscriptions.length} subscriptions`);
            
            for (const subscription of payload.subscriptions) {
              try {
                const _agent = await this.getZeroAgent(subscription.connectionId);
                console.log(`Successfully processed subscription for connection ${subscription.connectionId}`);
              } catch (error) {
                console.error(`Failed to process subscription for connection ${subscription.connectionId}:`, error);
                message.retry();
              }
            }
            break;
          }

          case 'thread-queue': {
            const payload = message.body as IThreadBatch;
            console.log(`Processing thread batch with ${payload.threads.length} threads`);
            
            for (const thread of payload.threads) {
              try {
                const _agent = await this.getZeroAgent(thread.connectionId);
                console.log(`Successfully processed thread for connection ${thread.connectionId}`);
              } catch (error) {
                console.error(`Failed to process thread for connection ${thread.connectionId}:`, error);
                message.retry();
              }
            }
            break;
          }

          default:
            console.warn(`Unknown queue: ${batch.queue}`);
        }

        message.ack();
      } catch (error) {
        console.error(`Error processing message from queue ${batch.queue}:`, error);
        message.retry();
      }
    }
  }

  async scheduled(event: ScheduledEvent): Promise<void> {
    console.log(`Scheduled event triggered: ${event.cron}`);
    
    switch (event.cron) {
      case '*/5 * * * *': {
        console.log('Running 5-minute scheduled task');
        break;
      }
      case '0 * * * *': {
        console.log('Running hourly scheduled task');
        break;
      }
      case '0 0 * * *': {
        console.log('Running daily scheduled task');
        break;
      }
      default:
        console.log(`Unknown cron pattern: ${event.cron}`);
    }
  }
}
