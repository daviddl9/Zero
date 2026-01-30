/**
 * Hooks for AI Draft Learning Memory System
 *
 * Provides query and mutation hooks for managing user preferences,
 * corrections, and learning data for personalized email drafting.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';

export type MemoryCategory = 'preference' | 'correction' | 'selection';

export interface Memory {
  id: string;
  content: string;
  category: MemoryCategory;
  recipientEmail?: string | null;
  recipientDomain?: string | null;
  weight: number | null;
  metadata: MemoryMetadata | null;
  score?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryMetadata {
  source: 'explicit' | 'correction' | 'selection';
  correctionType?: 'minor_tweak' | 'major_rewrite' | 'replacement';
  changePercentage?: number;
  selectedApproach?: string;
  rejectedApproaches?: string[];
  subjectKeywords?: string[];
  threadDepth?: number;
  reinforcementCount?: number;
  lastReinforcedAt?: string;
}

export interface MemoryAnalytics {
  totalMemories: number;
  memoriesByCategory: {
    preference: number;
    correction: number;
    selection: number;
  };
  memoriesByScope: {
    general: number;
    domainSpecific: number;
    personSpecific: number;
  };
  recentLearnings: Array<{
    id: string;
    content: string;
    category: MemoryCategory;
    createdAt: Date;
  }>;
  topDomains: Array<{ domain: string; count: number }>;
}

/**
 * Check if memory feature is enabled
 */
export function useMemoryEnabled() {
  const trpc = useTRPC();
  return useQuery(
    trpc.memory.isEnabled.queryOptions(void 0, {
      staleTime: 1000 * 60 * 60, // 1 hour
    }),
  );
}

/**
 * Get list of user's memories with optional filtering
 */
export function useMemories(options?: { category?: MemoryCategory; recipientDomain?: string }) {
  const trpc = useTRPC();
  return useQuery(
    trpc.memory.listPreferences.queryOptions(
      {
        category: options?.category,
        recipientDomain: options?.recipientDomain,
        limit: 100,
      },
      {
        staleTime: 1000 * 60 * 2, // 2 minutes
      },
    ),
  );
}

/**
 * Search memories semantically
 */
export function useSearchMemories(
  query: string,
  options?: {
    recipientEmail?: string;
    recipientDomain?: string;
    limit?: number;
    enabled?: boolean;
  },
) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.memory.search.queryOptions(
      {
        query,
        recipientEmail: options?.recipientEmail,
        recipientDomain: options?.recipientDomain,
        limit: options?.limit,
      },
      {
        staleTime: 1000 * 30, // 30 seconds
      },
    ),
    enabled: options?.enabled !== false && query.length > 0,
  });
}

/**
 * Get memory analytics for settings page
 */
export function useMemoryAnalytics() {
  const trpc = useTRPC();
  return useQuery(
    trpc.memory.getAnalytics.queryOptions(void 0, {
      staleTime: 1000 * 60 * 5, // 5 minutes
    }),
  );
}

/**
 * Mutations for memory management
 */
export function useMemoryMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidateMemories = () => {
    const listKey = trpc.memory.listPreferences.queryOptions({}).queryKey;
    const analyticsKey = trpc.memory.getAnalytics.queryOptions().queryKey;
    queryClient.invalidateQueries({ queryKey: listKey });
    queryClient.invalidateQueries({ queryKey: analyticsKey });
  };

  const addPreference = useMutation({
    ...trpc.memory.addPreference.mutationOptions(),
    onSuccess: invalidateMemories,
  });

  const updatePreference = useMutation({
    ...trpc.memory.updatePreference.mutationOptions(),
    onSuccess: invalidateMemories,
  });

  const deletePreference = useMutation({
    ...trpc.memory.deletePreference.mutationOptions(),
    onSuccess: invalidateMemories,
  });

  const clearAllMemories = useMutation({
    ...trpc.memory.clearAllMemories.mutationOptions(),
    onSuccess: invalidateMemories,
  });

  return {
    addPreference,
    updatePreference,
    deletePreference,
    clearAllMemories,
  };
}

/**
 * Mutations for recording learning events (corrections and selections)
 * These are fire-and-forget - they don't block the UI
 */
export function useLearningMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidateAnalytics = () => {
    const analyticsKey = trpc.memory.getAnalytics.queryOptions().queryKey;
    queryClient.invalidateQueries({ queryKey: analyticsKey });
  };

  const recordCorrection = useMutation({
    ...trpc.memory.recordCorrection.mutationOptions(),
    onSuccess: invalidateAnalytics,
    // Don't throw on error - these are non-critical background operations
    onError: (error) => {
      console.warn('[useLearningMutations] Failed to record correction:', error);
    },
  });

  const recordSelection = useMutation({
    ...trpc.memory.recordSelection.mutationOptions(),
    onSuccess: invalidateAnalytics,
    onError: (error) => {
      console.warn('[useLearningMutations] Failed to record selection:', error);
    },
  });

  return {
    recordCorrection,
    recordSelection,
  };
}
