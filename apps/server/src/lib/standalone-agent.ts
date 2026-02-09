/**
 * Standalone Zero Agent
 *
 * Provides a standalone implementation of the ZeroAgent interface that works
 * without Cloudflare Durable Objects. Uses the mail driver directly for API calls.
 */

import { createDriver } from './driver';
import type { IGetThreadsResponse, MailManager } from './driver/types';
import type { connection } from '../db/schema';

/**
 * StandaloneAgentStub - The stub interface that matches what server-utils expects
 * This is accessed as agent.stub.methodName()
 */
interface RecipientSuggestion {
  email: string;
  name: string | null;
  displayText: string;
}

interface RecipientCache {
  contacts: RecipientSuggestion[];
  timestamp: number;
}

// Module-level cache keyed by connection email, TTL 5 minutes
const recipientCaches = new Map<string, RecipientCache>();
const RECIPIENT_CACHE_TTL = 5 * 60 * 1000;

export interface StandaloneAgentStub {
  // Methods that are no-ops or simplified in standalone mode
  forceReSync(): Promise<void>;
  sendDraft(draftId: string, mail: unknown): Promise<unknown>;
  create(mail: unknown): Promise<unknown>;
  reloadFolder(folder: string): Promise<void>;
  syncThread(opts: { threadId: string }): Promise<void>;
  // Thread operations - in standalone mode, these query the API directly
  getThreadsFromDB(params: {
    labelIds?: string[];
    folder?: string;
    q?: string;
    maxResults?: number;
    pageToken?: string;
  }): Promise<IGetThreadsResponse>;
  suggestRecipients(query: string, limit: number): Promise<RecipientSuggestion[]>;
  // Direct driver methods also on the stub
  listDrafts: MailManager['listDrafts'];
  getDraft: MailManager['getDraft'];
  createDraft: MailManager['createDraft'];
  deleteDraft: MailManager['deleteDraft'];
  getUserLabels: MailManager['getUserLabels'];
  createLabel: MailManager['createLabel'];
  updateLabel: MailManager['updateLabel'];
  deleteLabel: MailManager['deleteLabel'];
  rawListThreads: MailManager['list'];
  normalizeIds: MailManager['normalizeIds'];
  getEmailAliases: MailManager['getEmailAliases'];
  getMessageAttachments: MailManager['getMessageAttachments'];
  getRawEmail: MailManager['getRawEmail'];
  getThread: MailManager['get'];
  modifyLabels: MailManager['modifyLabels'];
  sendMail: MailManager['create'];
}

/**
 * Create a standalone agent for the given connection
 *
 * This wraps the mail driver and provides an interface compatible with
 * the ZeroAgent Durable Object stub used in Cloudflare mode.
 * Returns { stub: StandaloneAgentStub } where stub has all methods directly accessible.
 */
export function createStandaloneAgent(
  activeConnection: typeof connection.$inferSelect,
): { stub: StandaloneAgentStub } {
  if (!activeConnection.accessToken || !activeConnection.refreshToken) {
    throw new Error(`Invalid connection: missing tokens for ${activeConnection.id}`);
  }

  const driver = createDriver(activeConnection.providerId, {
    auth: {
      userId: activeConnection.userId,
      accessToken: activeConnection.accessToken,
      refreshToken: activeConnection.refreshToken,
      email: activeConnection.email,
    },
  });

  // Create the stub with all methods directly accessible
  // This matches the shape expected by server-utils.ts: agent.stub.methodName()
  const stub: StandaloneAgentStub = {
    // Methods that are no-ops or simplified in standalone mode
    async forceReSync(): Promise<void> {
      console.log('[StandaloneAgent] forceReSync called - no-op in standalone mode');
    },

    async sendDraft(draftId: string, mail: unknown): Promise<unknown> {
      return driver.sendDraft(draftId, mail as Parameters<typeof driver.sendDraft>[1]);
    },

    async create(mail: unknown): Promise<unknown> {
      return driver.create(mail as Parameters<typeof driver.create>[0]);
    },

    async reloadFolder(_folder: string): Promise<void> {
      console.log('[StandaloneAgent] reloadFolder called - no-op in standalone mode');
    },

    async syncThread(_opts: { threadId: string }): Promise<void> {
      console.log('[StandaloneAgent] syncThread called - no-op in standalone mode');
    },

    async getThreadsFromDB(params: {
      labelIds?: string[];
      folder?: string;
      q?: string;
      maxResults?: number;
      pageToken?: string;
    }): Promise<IGetThreadsResponse> {
      // In standalone mode, query the Gmail API directly instead of a local cache
      return driver.list({
        folder: params.folder || 'INBOX',
        query: params.q,
        maxResults: params.maxResults,
        labelIds: params.labelIds,
        pageToken: params.pageToken,
      });
    },

    async suggestRecipients(
      query: string = '',
      limit: number = 10,
    ): Promise<RecipientSuggestion[]> {
      const cacheKey = activeConnection.email;
      const cached = recipientCaches.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < RECIPIENT_CACHE_TTL) {
        const lower = query.toLowerCase();
        const filtered = lower
          ? cached.contacts.filter(
              (c) =>
                c.email.toLowerCase().includes(lower) ||
                (c.name && c.name.toLowerCase().includes(lower)),
            )
          : cached.contacts;
        return filtered.slice(0, limit);
      }

      // Fetch recent threads and extract senders
      try {
        const { threads } = await driver.list({
          folder: 'INBOX',
          maxResults: 30,
        });

        const senderMap = new Map<
          string,
          { email: string; name: string | null; count: number }
        >();

        // Fetch thread details in parallel (batches of 5 to avoid rate limits)
        const batchSize = 5;
        for (let i = 0; i < threads.length; i += batchSize) {
          const batch = threads.slice(i, i + batchSize);
          const results = await Promise.allSettled(
            batch.map((t) => driver.get(t.id)),
          );
          for (const result of results) {
            if (result.status !== 'fulfilled') continue;
            const thread = result.value;
            for (const msg of thread.messages) {
              const from = msg.sender;
              if (!from?.email) continue;
              const key = from.email.toLowerCase();
              if (!senderMap.has(key)) {
                senderMap.set(key, {
                  email: from.email,
                  name: from.name || null,
                  count: 1,
                });
              } else {
                senderMap.get(key)!.count += 1;
              }
            }
          }
        }

        const contacts: RecipientSuggestion[] = Array.from(senderMap.values())
          .sort((a, b) => b.count - a.count)
          .map((c) => ({
            email: c.email,
            name: c.name,
            displayText: c.name ? `${c.name} <${c.email}>` : c.email,
          }));

        recipientCaches.set(cacheKey, { contacts, timestamp: Date.now() });

        const lower = query.toLowerCase();
        const filtered = lower
          ? contacts.filter(
              (c) =>
                c.email.toLowerCase().includes(lower) ||
                (c.name && c.name.toLowerCase().includes(lower)),
            )
          : contacts;
        return filtered.slice(0, limit);
      } catch (error) {
        console.error('[StandaloneAgent] suggestRecipients error:', error);
        return [];
      }
    },

    // Direct driver methods
    listDrafts: driver.listDrafts.bind(driver),
    getDraft: driver.getDraft.bind(driver),
    createDraft: driver.createDraft.bind(driver),
    deleteDraft: driver.deleteDraft.bind(driver),
    getUserLabels: driver.getUserLabels.bind(driver),
    createLabel: driver.createLabel.bind(driver),
    updateLabel: driver.updateLabel.bind(driver),
    deleteLabel: driver.deleteLabel.bind(driver),
    rawListThreads: driver.list.bind(driver),
    normalizeIds: driver.normalizeIds.bind(driver),
    getEmailAliases: driver.getEmailAliases.bind(driver),
    getMessageAttachments: driver.getMessageAttachments.bind(driver),
    getRawEmail: driver.getRawEmail.bind(driver),
    getThread: driver.get.bind(driver),
    modifyLabels: driver.modifyLabels.bind(driver),
    sendMail: driver.create.bind(driver),
  };

  return { stub };
}
