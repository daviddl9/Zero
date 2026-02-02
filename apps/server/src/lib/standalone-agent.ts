/**
 * Standalone Zero Agent
 *
 * Provides a standalone implementation of the ZeroAgent interface that works
 * without Cloudflare Durable Objects. Uses the mail driver directly for API calls.
 */

import { createDriver } from './driver';
import type { IGetThreadsResponse, MailManager } from './driver/types';
import type { connection } from '../db/schema';

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
}

export interface StandaloneZeroAgent {
  stub: StandaloneAgentStub;
  // Direct driver methods
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
  sendDraft: MailManager['sendDraft'];
}

/**
 * Create a standalone agent for the given connection
 *
 * This wraps the mail driver and provides an interface compatible with
 * the ZeroAgent Durable Object stub used in Cloudflare mode.
 */
export function createStandaloneAgent(
  activeConnection: typeof connection.$inferSelect,
): { stub: StandaloneZeroAgent } {
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

  // Create the stub with methods that interact with the driver
  const agentStub: StandaloneAgentStub = {
    async forceReSync(): Promise<void> {
      // In standalone mode, there's no local cache to resync
      // The driver calls Gmail API directly each time
      console.log('[StandaloneAgent] forceReSync called - no-op in standalone mode');
    },

    async sendDraft(draftId: string, mail: unknown): Promise<unknown> {
      return driver.sendDraft(draftId, mail as Parameters<typeof driver.sendDraft>[1]);
    },

    async create(mail: unknown): Promise<unknown> {
      return driver.create(mail as Parameters<typeof driver.create>[0]);
    },

    async reloadFolder(_folder: string): Promise<void> {
      // In standalone mode, there's no local cache to reload
      console.log('[StandaloneAgent] reloadFolder called - no-op in standalone mode');
    },

    async syncThread(_opts: { threadId: string }): Promise<void> {
      // In standalone mode, threads are fetched directly from API
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
  };

  // Create the full agent with both stub and direct driver methods
  const agent: StandaloneZeroAgent = {
    stub: agentStub,

    // Draft operations
    listDrafts: driver.listDrafts.bind(driver),
    getDraft: driver.getDraft.bind(driver),
    createDraft: driver.createDraft.bind(driver),
    deleteDraft: driver.deleteDraft.bind(driver),

    // Label operations
    getUserLabels: driver.getUserLabels.bind(driver),
    createLabel: driver.createLabel.bind(driver),
    updateLabel: driver.updateLabel.bind(driver),
    deleteLabel: driver.deleteLabel.bind(driver),

    // Other operations
    rawListThreads: driver.list.bind(driver),
    normalizeIds: driver.normalizeIds.bind(driver),
    getEmailAliases: driver.getEmailAliases.bind(driver),
    getMessageAttachments: driver.getMessageAttachments.bind(driver),
    getRawEmail: driver.getRawEmail.bind(driver),
    getThread: driver.get.bind(driver),
    modifyLabels: driver.modifyLabels.bind(driver),
    sendMail: driver.create.bind(driver),
    sendDraft: driver.sendDraft.bind(driver),
  };

  return { stub: agent };
}
