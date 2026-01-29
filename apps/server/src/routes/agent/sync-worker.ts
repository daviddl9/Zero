import { connection as connectionSchema } from '../../db/schema';
import { connectionToDriver } from '../../lib/server-utils';
import { withRetry } from '../../lib/gmail-rate-limit';
import { DurableObject } from 'cloudflare:workers';
import type { ParsedMessage } from '../../types';
import type { ZeroEnv } from '../../env';
import { Effect } from 'effect';
import {
  createThreadStorage,
  type IThreadStorage,
} from '../../lib/thread-storage';

export class ThreadSyncWorker extends DurableObject<ZeroEnv> {
  private threadStorage: IThreadStorage;

  constructor(state: DurableObjectState, env: ZeroEnv) {
    super(state, env);
    // In Cloudflare Workers mode, use R2 bucket
    this.threadStorage = createThreadStorage({ r2Bucket: env.THREADS_BUCKET });
  }

  public async syncThread(
    connection: typeof connectionSchema.$inferSelect,
    threadId: string,
  ): Promise<ParsedMessage | undefined> {
    const driver = connectionToDriver(connection);
    if (!driver) throw new Error('No driver available');

    const thread = await Effect.runPromise(
      withRetry(Effect.tryPromise(() => driver.get(threadId))),
    );

    await this.threadStorage.putThread(connection.id, threadId, thread);

    return thread.latest;
  }
}
