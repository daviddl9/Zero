import { useMemo } from 'react';
import { useSearchIndex } from '@/lib/search';
import type { IndexedContact } from '@/lib/search';

interface UseContactSearchReturn {
  contacts: IndexedContact[];
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

  return {
    contacts,
    isReady: searchIndex?.isReady ?? false,
  };
}
