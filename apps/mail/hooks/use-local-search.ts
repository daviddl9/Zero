import { useMemo, useState, useEffect } from 'react';
import { useSearchIndex } from '@/lib/search';
import { hasUnsupportedOperators, parseSearchQuery } from '@/lib/search';

interface LocalSearchResult {
  id: string;
  subject: string;
  snippet: string;
  senderName: string;
  senderEmail: string;
  receivedOn: string;
  hasUnread: boolean;
  isStarred: boolean;
  totalReplies: number;
  score: number;
}

interface UseLocalSearchReturn {
  results: LocalSearchResult[];
  isLocal: boolean;
  isReady: boolean;
}

export function useLocalSearch(
  query: string,
  options?: { limit?: number },
): UseLocalSearchReturn {
  const searchIndex = useSearchIndex();
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    if (!query.trim()) {
      setDebouncedQuery('');
      return;
    }
    const timer = setTimeout(() => setDebouncedQuery(query), 100);
    return () => clearTimeout(timer);
  }, [query]);

  const { results, isLocal } = useMemo(() => {
    if (!searchIndex?.isReady || !debouncedQuery.trim()) {
      return { results: [], isLocal: false };
    }

    const parsed = parseSearchQuery(debouncedQuery);
    if (hasUnsupportedOperators(parsed)) {
      return { results: [], isLocal: false };
    }

    const searchResults = searchIndex.search(debouncedQuery, options);
    return {
      results: searchResults,
      isLocal: searchResults.length > 0,
    };
  }, [searchIndex, debouncedQuery, options?.limit]);

  return {
    results,
    isLocal,
    isReady: searchIndex?.isReady ?? false,
  };
}
