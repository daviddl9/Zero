import MiniSearch from 'minisearch';
import type { IndexedThread } from './types';

const SEARCH_FIELDS = ['subject', 'snippet', 'senderName', 'senderEmail', 'toNames', 'toEmails'];
const BOOST = { subject: 3, senderName: 2, senderEmail: 2, snippet: 1, toNames: 1, toEmails: 1 };

let index: MiniSearch<IndexedThread> | null = null;

function createIndex(): MiniSearch<IndexedThread> {
  return new MiniSearch<IndexedThread>({
    fields: SEARCH_FIELDS,
    storeFields: [
      'id',
      'subject',
      'snippet',
      'senderName',
      'senderEmail',
      'toEmails',
      'toNames',
      'ccEmails',
      'receivedOn',
      'labels',
      'hasUnread',
      'isStarred',
      'totalReplies',
      'indexedAt',
    ],
    idField: 'id',
    searchOptions: {
      boost: BOOST,
      prefix: true,
      fuzzy: 0.2,
    },
  });
}

export function getSearchIndex(): MiniSearch<IndexedThread> {
  if (!index) {
    index = createIndex();
  }
  return index;
}

export function addThreads(threads: IndexedThread[]): void {
  const idx = getSearchIndex();
  for (const thread of threads) {
    if (idx.has(thread.id)) {
      idx.replace(thread);
    } else {
      idx.add(thread);
    }
  }
}

export function removeThread(id: string): void {
  const idx = getSearchIndex();
  if (idx.has(id)) {
    idx.discard(id);
  }
}

export function search(
  query: string,
  options?: { limit?: number },
): Array<IndexedThread & { score: number }> {
  const idx = getSearchIndex();
  const results = idx.search(query, {
    prefix: true,
    fuzzy: 0.2,
    boost: BOOST,
  });
  const limit = options?.limit ?? 50;
  return results.slice(0, limit) as Array<IndexedThread & { score: number }>;
}

export function rebuild(threads: IndexedThread[]): void {
  index = createIndex();
  if (threads.length > 0) {
    index.addAll(threads);
  }
}

export function getIndexSize(): number {
  return index ? index.documentCount : 0;
}
