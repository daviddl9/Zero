/**
 * Standalone Zero Agent
 *
 * Provides a standalone implementation of the ZeroAgent interface that works
 * without Cloudflare Durable Objects. Uses the mail driver directly for API calls.
 */

import { getCachedThreadList, setCachedThreadList } from './thread-list-cache';
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
  searchThreads(params: {
    query: string;
    folder?: string;
    maxResults?: number;
  }): Promise<{ threadIds: string[]; source: string; nextPageToken?: string }>;
  // Direct driver methods also on the stub
  listDrafts: MailManager['listDrafts'];
  getDraft: MailManager['getDraft'];
  createDraft: MailManager['createDraft'];
  deleteDraft: MailManager['deleteDraft'];
  getUserLabels: MailManager['getUserLabels'];
  createLabel: MailManager['createLabel'];
  updateLabel: MailManager['updateLabel'];
  deleteLabel: MailManager['deleteLabel'];
  rawListThreads: MailManager['listEnriched'];
  normalizeIds: MailManager['normalizeIds'];
  getEmailAliases: MailManager['getEmailAliases'];
  getThreadLabels: MailManager['getThreadLabels'];
  getAttachment: MailManager['getAttachment'];
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
      // Try Redis cache first
      const cached = await getCachedThreadList(activeConnection.id, params);
      if (cached) return cached;

      // Cache miss — fetch from Gmail API with enriched metadata
      const result = await driver.listEnriched({
        folder: params.folder || 'INBOX',
        query: params.q,
        maxResults: params.maxResults,
        labelIds: params.labelIds,
        pageToken: params.pageToken,
      });

      // Store in cache (non-blocking, 60s TTL)
      setCachedThreadList(activeConnection.id, params, result);

      return result;
    },

    async searchThreads(params: {
      query: string;
      folder?: string;
      maxResults?: number;
    }): Promise<{ threadIds: string[]; source: string; nextPageToken?: string }> {
      const result = await driver.list({
        folder: params.folder || 'all mail',
        query: params.query,
        maxResults: params.maxResults || 20,
      });
      return {
        threadIds: result.threads.map((t) => t.id),
        source: 'raw',
      };
    },

    async suggestRecipients(
      query: string = '',
      limit: number = 10,
    ): Promise<RecipientSuggestion[]> {
      const cacheKey = activeConnection.email;
      const cached = recipientCaches.get(cacheKey);
      const lower = query.toLowerCase();

      // Helper: extract unique senders from thread IDs
      const extractSenders = async (
        threadIds: { id: string }[],
        into: Map<string, { email: string; name: string | null; count: number }>,
      ) => {
        const batchSize = 5;
        for (let i = 0; i < threadIds.length; i += batchSize) {
          const batch = threadIds.slice(i, i + batchSize);
          const results = await Promise.allSettled(
            batch.map((t) => driver.get(t.id)),
          );
          for (const result of results) {
            if (result.status !== 'fulfilled') continue;
            for (const msg of result.value.messages) {
              const from = msg.sender;
              if (!from?.email) continue;
              const key = from.email.toLowerCase();
              if (!into.has(key)) {
                into.set(key, { email: from.email, name: from.name || null, count: 1 });
              } else {
                into.get(key)!.count += 1;
              }
            }
          }
        }
      };

      const toSuggestions = (
        map: Map<string, { email: string; name: string | null; count: number }>,
      ): RecipientSuggestion[] =>
        Array.from(map.values())
          .sort((a, b) => b.count - a.count)
          .map((c) => ({
            email: c.email,
            name: c.name,
            displayText: c.name ? `${c.name} <${c.email}>` : c.email,
          }));

      // 1. Try cache first
      if (cached && Date.now() - cached.timestamp < RECIPIENT_CACHE_TTL) {
        const filtered = lower
          ? cached.contacts.filter(
              (c) =>
                c.email.toLowerCase().includes(lower) ||
                (c.name && c.name.toLowerCase().includes(lower)),
            )
          : cached.contacts;

        // If cache has enough matches, return them
        if (filtered.length >= limit || !lower) {
          return filtered.slice(0, limit);
        }

        // Cache didn't have enough — do a targeted Gmail search below
      }

      // 2. If no query, build the base cache from recent inbox threads
      if (!lower) {
        try {
          const { threads } = await driver.list({ folder: 'INBOX', maxResults: 30 });
          const senderMap = new Map<string, { email: string; name: string | null; count: number }>();
          await extractSenders(threads, senderMap);
          const contacts = toSuggestions(senderMap);
          recipientCaches.set(cacheKey, { contacts, timestamp: Date.now() });
          return contacts.slice(0, limit);
        } catch (error) {
          console.error('[StandaloneAgent] suggestRecipients cache build error:', error);
          return [];
        }
      }

      // 3. Query provided — do a general Gmail search then filter senders
      //    Using general search (not `from:`) because Gmail's from: operator
      //    requires exact token matches (e.g. from:chace won't match chaceteo@...)
      try {
        const { threads } = await driver.list({
          folder: 'INBOX',
          query: query,
          maxResults: 15,
        });

        const senderMap = new Map<string, { email: string; name: string | null; count: number }>();
        await extractSenders(threads, senderMap);

        // Filter senders whose email or name contains the search term
        const allSenders = toSuggestions(senderMap);
        const results = allSenders.filter(
          (s) =>
            s.email.toLowerCase().includes(lower) ||
            (s.name && s.name.toLowerCase().includes(lower)),
        );

        // Merge with cached contacts if available
        const cachedMatches = cached
          ? cached.contacts.filter(
              (c) =>
                c.email.toLowerCase().includes(lower) ||
                (c.name && c.name.toLowerCase().includes(lower)),
            )
          : [];

        // Dedupe: targeted search results first, then cached matches
        const seen = new Set(results.map((r) => r.email.toLowerCase()));
        for (const c of cachedMatches) {
          if (!seen.has(c.email.toLowerCase())) {
            results.push(c);
            seen.add(c.email.toLowerCase());
          }
        }

        return results.slice(0, limit);
      } catch (error) {
        console.error('[StandaloneAgent] suggestRecipients search error:', error);
        // Fall back to whatever we have in cache
        if (cached) {
          return cached.contacts
            .filter(
              (c) =>
                c.email.toLowerCase().includes(lower) ||
                (c.name && c.name.toLowerCase().includes(lower)),
            )
            .slice(0, limit);
        }
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
    rawListThreads: driver.listEnriched.bind(driver),
    normalizeIds: driver.normalizeIds.bind(driver),
    getEmailAliases: driver.getEmailAliases.bind(driver),
    getThreadLabels: driver.getThreadLabels.bind(driver),
    getAttachment: driver.getAttachment.bind(driver),
    getMessageAttachments: driver.getMessageAttachments.bind(driver),
    getRawEmail: driver.getRawEmail.bind(driver),
    getThread: driver.get.bind(driver),
    modifyLabels: driver.modifyLabels.bind(driver),
    sendMail: driver.create.bind(driver),
  };

  return { stub };
}
