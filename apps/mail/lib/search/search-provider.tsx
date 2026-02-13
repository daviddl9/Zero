import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { QueryCache } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useActiveConnection } from '@/hooks/use-connections';
import { trpcClient } from '@/providers/query-provider';
import { getSearchDb, closeSearchDb } from './search-db';
import { addThreads, rebuild, getIndexSize } from './search-index';
import {
  extractContacts,
  upsertContacts,
  loadContactsIntoMemory,
  searchContacts,
  getContactCount,
} from './contact-index';
import { search as miniSearch } from './search-index';
import { useBackgroundSync } from './background-sync';
import { parseSearchQuery, hasUnsupportedOperators } from './query-parser';
import type { IndexedThread, IndexedContact, ParsedQuery } from './types';

interface SearchResult {
  id: string;
  subject: string;
  snippet: string;
  senderName: string;
  senderEmail: string;
  toEmails: string;
  toNames: string;
  receivedOn: string;
  labels: string;
  hasUnread: boolean;
  isStarred: boolean;
  totalReplies: number;
  score: number;
}

interface SearchIndexContextValue {
  isReady: boolean;
  threadCount: number;
  contactCount: number;
  search: (query: string, options?: { limit?: number }) => SearchResult[];
  searchContacts: (query: string, limit?: number) => IndexedContact[];
}

const SearchIndexContext = createContext<SearchIndexContextValue | null>(null);

export function useSearchIndex() {
  return useContext(SearchIndexContext);
}

interface ThreadSummaryFromCache {
  id: string;
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
}

function threadToIndexed(thread: ThreadSummaryFromCache): IndexedThread {
  return {
    id: thread.id,
    subject: thread.subject || '',
    snippet: thread.snippet || '',
    senderName: thread.sender?.name || '',
    senderEmail: thread.sender?.email || '',
    toEmails: (thread.to || []).map((r) => r.email).join(' '),
    toNames: (thread.to || [])
      .map((r) => r.name || '')
      .filter(Boolean)
      .join(' '),
    ccEmails: (thread.cc || []).map((r) => r.email).join(' '),
    receivedOn: thread.receivedOn || '',
    labels: (thread.labels || []).map((l) => l.id).join(','),
    hasUnread: thread.hasUnread ?? false,
    isStarred: (thread.tags || []).some((t) => t.id === 'STARRED'),
    totalReplies: thread.totalReplies ?? 0,
    indexedAt: Date.now(),
  };
}

function applyPostFilters(
  results: Array<IndexedThread & { score: number }>,
  parsed: ParsedQuery,
): SearchResult[] {
  let filtered = results as SearchResult[];

  if (parsed.from) {
    const from = parsed.from.toLowerCase();
    filtered = filtered.filter(
      (r) => r.senderEmail.toLowerCase().includes(from) || r.senderName.toLowerCase().includes(from),
    );
  }

  if (parsed.to) {
    const to = parsed.to.toLowerCase();
    filtered = filtered.filter(
      (r) => r.toEmails.toLowerCase().includes(to) || r.toNames.toLowerCase().includes(to),
    );
  }

  if (parsed.subject) {
    const subject = parsed.subject.toLowerCase();
    filtered = filtered.filter((r) => r.subject.toLowerCase().includes(subject));
  }

  if (parsed.isUnread !== undefined) {
    filtered = filtered.filter((r) => r.hasUnread === parsed.isUnread);
  }

  if (parsed.isStarred !== undefined) {
    filtered = filtered.filter((r) => r.isStarred === parsed.isStarred);
  }

  if (parsed.after) {
    const afterDate = normalizeDate(parsed.after);
    if (afterDate) {
      filtered = filtered.filter((r) => r.receivedOn >= afterDate);
    }
  }

  if (parsed.before) {
    const beforeDate = normalizeDate(parsed.before);
    if (beforeDate) {
      filtered = filtered.filter((r) => r.receivedOn <= beforeDate);
    }
  }

  return filtered;
}

function normalizeDate(dateStr: string): string {
  // Support both YYYY/MM/DD and YYYY-MM-DD
  const normalized = dateStr.replace(/\//g, '-');
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return '';
  return d.toISOString();
}

export function SearchIndexProvider({ children }: { children: React.ReactNode }) {
  const { data: connection } = useActiveConnection();
  const connectionId = connection?.id ?? null;
  const queryClient = useQueryClient();
  const [isReady, setIsReady] = useState(false);
  const [threadCount, setThreadCount] = useState(0);
  const [contactCount, setContactCount] = useState(0);
  const initRef = useRef(false);
  const connectionRef = useRef<string | null>(null);

  // Initialize: load from Dexie into MiniSearch
  useEffect(() => {
    if (!connectionId) return;
    if (connectionRef.current === connectionId && initRef.current) return;

    connectionRef.current = connectionId;
    initRef.current = false;
    setIsReady(false);

    const init = async () => {
      try {
        const db = getSearchDb(connectionId);
        const threads = await db.threads.toArray();
        rebuild(threads);
        await loadContactsIntoMemory(db);
        setThreadCount(getIndexSize());
        setContactCount(getContactCount());
        initRef.current = true;
        setIsReady(true);
      } catch (err) {
        console.warn('[SearchIndex] Failed to initialize:', err);
        initRef.current = true;
        setIsReady(true);
      }
    };

    // Use requestIdleCallback for non-blocking init
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => void init());
    } else {
      setTimeout(() => void init(), 100);
    }

    return () => {
      closeSearchDb();
      initRef.current = false;
      connectionRef.current = null;
    };
  }, [connectionId]);

  // Subscribe to React Query cache for listThreads updates
  useEffect(() => {
    if (!connectionId || !isReady) return;

    const cache: QueryCache = queryClient.getQueryCache();
    const unsubscribe = cache.subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') return;

      const queryKey = event.query.queryKey;
      // Match listThreads queries: [["mail","listThreads"], ...]
      if (
        !Array.isArray(queryKey) ||
        !Array.isArray(queryKey[0]) ||
        queryKey[0][0] !== 'mail' ||
        queryKey[0][1] !== 'listThreads'
      ) {
        return;
      }

      const data = event.query.state.data as
        | { pages?: Array<{ threads?: ThreadSummaryFromCache[] }> }
        | undefined;

      if (!data?.pages) return;

      const allThreads: ThreadSummaryFromCache[] = data.pages.flatMap((p) => p.threads || []);
      if (allThreads.length === 0) return;

      // Index in background
      void indexThreadsBatch(connectionId, allThreads);
    });

    return unsubscribe;
  }, [connectionId, isReady, queryClient]);

  const indexThreadsBatch = useCallback(
    async (connId: string, threads: ThreadSummaryFromCache[]) => {
      try {
        const db = getSearchDb(connId);
        const indexed = threads.map(threadToIndexed);
        addThreads(indexed);
        await db.threads.bulkPut(indexed);

        // Extract and upsert contacts
        const allContacts = threads.flatMap((t) => extractContacts(t.sender, t.to, t.cc));
        await upsertContacts(db, allContacts);
        await loadContactsIntoMemory(db);

        setThreadCount(getIndexSize());
        setContactCount(getContactCount());
      } catch (err) {
        console.warn('[SearchIndex] Failed to index batch:', err);
      }
    },
    [],
  );

  const fetchThreads = useCallback(
    async (folder: string, cursor: string) => {
      const result = await trpcClient.mail.listThreads.query({
        folder,
        cursor: cursor || undefined,
      });
      return {
        threads: (result.threads ?? []) as ThreadSummaryFromCache[],
        nextPageToken: result.nextPageToken ?? null,
      };
    },
    [],
  );

  // Background sync: index sent emails for contact + thread search coverage
  useBackgroundSync(connectionId, isReady, indexThreadsBatch, fetchThreads);

  const searchFn = useCallback(
    (query: string, options?: { limit?: number }): SearchResult[] => {
      if (!isReady || !query.trim()) return [];

      const parsed = parseSearchQuery(query);

      // If only structured operators (no free text), do a full scan with post-filters
      if (!parsed.freeText && !hasUnsupportedOperators(parsed)) {
        // Get all documents via a broad search and apply post-filters
        const allResults = miniSearch('*', { limit: 10000 }) as Array<IndexedThread & { score: number }>;
        // If wildcard doesn't work well, fall back to getting from Dexie
        if (allResults.length === 0) {
          // For pure operator queries, we need all indexed docs
          // MiniSearch requires text to search, so we use the search-db directly
          return [];
        }
        return applyPostFilters(allResults, parsed).slice(0, options?.limit ?? 50);
      }

      if (hasUnsupportedOperators(parsed)) {
        return [];
      }

      // Free text search with post-filters
      const searchText = parsed.subject
        ? `${parsed.subject} ${parsed.freeText}`.trim()
        : parsed.freeText;

      if (!searchText) return [];

      const results = miniSearch(searchText, { limit: 200 });
      return applyPostFilters(results, parsed).slice(0, options?.limit ?? 50);
    },
    [isReady],
  );

  const searchContactsFn = useCallback(
    (query: string, limit?: number): IndexedContact[] => {
      if (!isReady) return [];
      return searchContacts(query, limit);
    },
    [isReady],
  );

  const value: SearchIndexContextValue = {
    isReady,
    threadCount,
    contactCount,
    search: searchFn,
    searchContacts: searchContactsFn,
  };

  return <SearchIndexContext.Provider value={value}>{children}</SearchIndexContext.Provider>;
}
