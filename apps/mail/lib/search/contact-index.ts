import type { IndexedContact } from './types';
import type { SearchDatabase } from './search-db';

interface ThreadContact {
  name?: string;
  email: string;
}

let contactsCache: IndexedContact[] = [];

export function extractContacts(
  sender?: ThreadContact,
  to?: ThreadContact[],
  cc?: ThreadContact[] | null,
): IndexedContact[] {
  const contacts: IndexedContact[] = [];
  const now = Date.now();

  if (sender?.email) {
    contacts.push({
      email: sender.email.toLowerCase(),
      name: sender.name || '',
      interactionCount: 1,
      lastSeen: now,
    });
  }

  if (to) {
    for (const recipient of to) {
      if (recipient.email) {
        contacts.push({
          email: recipient.email.toLowerCase(),
          name: recipient.name || '',
          interactionCount: 1,
          lastSeen: now,
        });
      }
    }
  }

  if (cc) {
    for (const recipient of cc) {
      if (recipient.email) {
        contacts.push({
          email: recipient.email.toLowerCase(),
          name: recipient.name || '',
          interactionCount: 1,
          lastSeen: now,
        });
      }
    }
  }

  return contacts;
}

export async function upsertContacts(db: SearchDatabase, contacts: IndexedContact[]): Promise<void> {
  if (contacts.length === 0) return;

  const emails = contacts.map((c) => c.email);
  const existing = await db.contacts.where('email').anyOf(emails).toArray();
  const existingMap = new Map(existing.map((c) => [c.email, c]));

  const toUpsert: IndexedContact[] = [];
  for (const contact of contacts) {
    const prev = existingMap.get(contact.email);
    if (prev) {
      toUpsert.push({
        ...prev,
        name: contact.name || prev.name,
        interactionCount: prev.interactionCount + 1,
        lastSeen: Math.max(prev.lastSeen, contact.lastSeen),
      });
    } else {
      toUpsert.push(contact);
    }
  }

  await db.contacts.bulkPut(toUpsert);
}

export async function loadContactsIntoMemory(db: SearchDatabase): Promise<IndexedContact[]> {
  contactsCache = await db.contacts.orderBy('interactionCount').reverse().toArray();
  return contactsCache;
}

export function searchContacts(query: string, limit = 10): IndexedContact[] {
  if (!query || query.length < 1) return [];
  const term = query.toLowerCase();
  const results: IndexedContact[] = [];

  for (const contact of contactsCache) {
    if (
      contact.email.includes(term) ||
      contact.name.toLowerCase().includes(term)
    ) {
      results.push(contact);
      if (results.length >= limit) break;
    }
  }

  return results;
}

export function getContactCount(): number {
  return contactsCache.length;
}
