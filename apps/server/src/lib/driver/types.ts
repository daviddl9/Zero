import type { IOutgoingMessage, ParsedMessage, Label, DeleteAllSpamResponse } from '../../types';
import { ParsedMessageSchema } from '../../types';
import type { CreateDraftData } from '../schemas';
import { z } from 'zod';

export interface IGetThreadResponse {
  messages: ParsedMessage[];
  latest?: ParsedMessage;
  hasUnread: boolean;
  totalReplies: number;
  labels: { id: string; name: string }[];
  isLatestDraft?: boolean;
}

export const IGetThreadResponseSchema = z.object({
  messages: z.array(ParsedMessageSchema),
  latest: ParsedMessageSchema.optional(),
  hasUnread: z.boolean(),
  totalReplies: z.number(),
  labels: z.array(z.object({ id: z.string(), name: z.string() })),
});

export interface ParsedDraft {
  id: string;
  to?: string[];
  subject?: string;
  content?: string;
  rawMessage?: {
    internalDate?: string | null;
  };
  cc?: string[];
  bcc?: string[];
}

export interface IConfig {
  auth?: {
    access_token: string;
    refresh_token: string;
    email: string;
  };
}

export type ManagerConfig = {
  auth: {
    userId: string;
    // accountId: string;
    accessToken: string;
    refreshToken: string;
    email: string;
  };
};

export interface MailManager {
  config: ManagerConfig;
  getMessageAttachments(id: string): Promise<
    {
      filename: string;
      mimeType: string;
      size: number;
      attachmentId: string;
      headers: { name: string; value: string }[];
      body: string;
    }[]
  >;
  get(id: string): Promise<IGetThreadResponse>;
  create(data: IOutgoingMessage): Promise<{ id?: string | null }>;
  sendDraft(id: string, data: IOutgoingMessage): Promise<void>;
  createDraft(
    data: CreateDraftData,
  ): Promise<{ id?: string | null; success?: boolean; error?: string }>;
  getDraft(id: string): Promise<ParsedDraft>;
  listDrafts(params: { q?: string; maxResults?: number; pageToken?: string }): Promise<{
    threads: { id: string; historyId: string | null; $raw: unknown }[];
    nextPageToken: string | null;
  }>;
  delete(id: string): Promise<void>;
  deleteDraft(id: string): Promise<void>;
  list(params: {
    folder: string;
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string | number;
  }): Promise<IGetThreadsResponse>;
  listEnriched(params: {
    folder: string;
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string;
  }): Promise<IGetThreadsResponse>;
  count(): Promise<{ count?: number; label?: string }[]>;
  getTokens(
    code: string,
  ): Promise<{ tokens: { access_token?: string; refresh_token?: string; expiry_date?: number } }>;
  getUserInfo(
    tokens?: ManagerConfig['auth'],
  ): Promise<{ address: string; name: string; photo: string }>;
  getScope(): string;
  listHistory<T>(historyId: string): Promise<{ history: T[]; historyId: string }>;
  markAsRead(threadIds: string[]): Promise<void>;
  markAsUnread(threadIds: string[]): Promise<void>;
  normalizeIds(id: string[]): { threadIds: string[] };
  modifyLabels(
    id: string[],
    options: { addLabels: string[]; removeLabels: string[] },
  ): Promise<void>;
  getThreadLabels(threadId: string): Promise<string[]>;
  getAttachment(messageId: string, attachmentId: string): Promise<string | undefined>;
  getUserLabels(): Promise<Label[]>;
  getLabel(id: string): Promise<Label>;
  createLabel(label: {
    name: string;
    color?: { backgroundColor: string; textColor: string };
  }): Promise<void>;
  updateLabel(
    id: string,
    label: { name: string; color?: { backgroundColor: string; textColor: string } },
  ): Promise<void>;
  deleteLabel(id: string): Promise<void>;
  getEmailAliases(): Promise<{ email: string; name?: string; primary?: boolean }[]>;
  revokeToken(token: string): Promise<boolean>;
  deleteAllSpam(): Promise<DeleteAllSpamResponse>;
  getRawEmail(id: string): Promise<string>;
}

export interface ThreadSummary {
  id: string;
  historyId: string | null;
  $raw?: unknown;
  // Enrichment fields (optional — absent in Cloudflare mode)
  subject?: string;
  snippet?: string;
  sender?: { name?: string; email: string };
  to?: { name?: string; email: string }[];
  cc?: { name?: string; email: string }[] | null;
  receivedOn?: string;
  tags?: { id: string; name: string; type: string }[];
  hasUnread?: boolean;
  totalReplies?: number;
  labels?: { id: string; name: string }[];
  hasDraft?: boolean;
  isGroupThread?: boolean;
  threadId?: string;
}

export interface IGetThreadsResponse {
  threads: ThreadSummary[];
  nextPageToken: string | null;
}

const ThreadSummarySchema = z.object({
  id: z.string(),
  historyId: z.string().nullable(),
  $raw: z.unknown().optional(),
  subject: z.string().optional(),
  snippet: z.string().optional(),
  sender: z.object({ name: z.string().optional(), email: z.string() }).optional(),
  to: z.array(z.object({ name: z.string().optional(), email: z.string() })).optional(),
  cc: z.array(z.object({ name: z.string().optional(), email: z.string() })).nullable().optional(),
  receivedOn: z.string().optional(),
  tags: z.array(z.object({ id: z.string(), name: z.string(), type: z.string() })).optional(),
  hasUnread: z.boolean().optional(),
  totalReplies: z.number().optional(),
  labels: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  hasDraft: z.boolean().optional(),
  isGroupThread: z.boolean().optional(),
  threadId: z.string().optional(),
});

export const IGetThreadsResponseSchema = z.object({
  threads: z.array(ThreadSummarySchema),
  nextPageToken: z.string().nullable(),
});
