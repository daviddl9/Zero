import Dexie, { type EntityTable } from 'dexie';
import type { IndexedThread, IndexedContact } from './types';

export class SearchDatabase extends Dexie {
  threads!: EntityTable<IndexedThread, 'id'>;
  contacts!: EntityTable<IndexedContact, 'email'>;

  constructor(connectionId: string) {
    super(`zero-search-${connectionId}`);
    this.version(1).stores({
      threads: 'id, senderEmail, receivedOn',
      contacts: 'email, interactionCount',
    });
  }
}

let currentDb: SearchDatabase | null = null;
let currentConnectionId: string | null = null;

export function getSearchDb(connectionId: string): SearchDatabase {
  if (currentDb && currentConnectionId === connectionId) {
    return currentDb;
  }
  if (currentDb) {
    currentDb.close();
  }
  currentDb = new SearchDatabase(connectionId);
  currentConnectionId = connectionId;
  return currentDb;
}

export function closeSearchDb(): void {
  if (currentDb) {
    currentDb.close();
    currentDb = null;
    currentConnectionId = null;
  }
}
