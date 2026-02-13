export interface IndexedThread {
  id: string;
  subject: string;
  snippet: string;
  senderName: string;
  senderEmail: string;
  toEmails: string;
  toNames: string;
  ccEmails: string;
  receivedOn: string;
  labels: string;
  hasUnread: boolean;
  isStarred: boolean;
  totalReplies: number;
  indexedAt: number;
}

export interface IndexedContact {
  email: string;
  name: string;
  interactionCount: number;
  lastSeen: number;
}

export interface SyncProgress {
  id: string;
  folder: string;
  nextPageToken: string | null;
  completed: boolean;
  lastSyncedAt: number;
  totalIndexed: number;
}

export interface ParsedQuery {
  freeText: string;
  from?: string;
  to?: string;
  subject?: string;
  isUnread?: boolean;
  isStarred?: boolean;
  after?: string;
  before?: string;
  unsupported: string[];
}
