import { useMemo, useCallback } from 'react';
import { useSearchIndex } from '@/lib/search';
import type { IndexedContact } from '@/lib/search';

interface UseContactSearchReturn {
  contacts: IndexedContact[];
  getTopContacts: (limit?: number) => IndexedContact[];
  isReady: boolean;
}

export function useContactSearch(query: string, limit = 10): UseContactSearchReturn {
  const searchIndex = useSearchIndex();

  const contacts = useMemo(() => {
    if (!searchIndex?.isReady || !query || query.trim().length < 1) {
      return [];
    }
    return searchIndex.searchContacts(query, limit);
  }, [searchIndex, query, limit]);

  const getTopContacts = useCallback(
    (topLimit?: number): IndexedContact[] => {
      if (!searchIndex?.isReady) return [];
      return searchIndex.getTopContacts(topLimit);
    },
    [searchIndex],
  );

  return {
    contacts,
    getTopContacts,
    isReady: searchIndex?.isReady ?? false,
  };
}
