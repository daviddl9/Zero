'use client';

import { useQueryState } from 'nuqs';
import { useCallback } from 'react';

export type WorkflowAIMode = 'draft' | 'analysis';

/**
 * Hook for managing the Workflow AI sidebar state.
 * Uses URL query parameters for state persistence, enabling:
 * - Deep linking to sidebar states
 * - Browser back/forward navigation
 * - Shareable URLs with sidebar state
 */
export function useWorkflowAI() {
  const [isOpenQuery, setIsOpenQuery] = useQueryState('workflowAI');
  const [modeQuery, setModeQuery] = useQueryState('workflowAIMode');

  // Convert query string to boolean
  const isOpen = isOpenQuery === 'true';

  // Default to 'draft' mode if no mode is set or invalid
  const mode: WorkflowAIMode = modeQuery === 'analysis' ? 'analysis' : 'draft';

  /**
   * Set the open state of the workflow AI sidebar.
   * When closing, removes the query parameter entirely.
   */
  const setOpen = useCallback(
    (open: boolean) => {
      if (open) {
        setIsOpenQuery('true').catch(console.error);
      } else {
        // Remove query param when closing for cleaner URLs
        setIsOpenQuery(null).catch(console.error);
        // Also reset mode when closing
        setModeQuery(null).catch(console.error);
      }
    },
    [setIsOpenQuery, setModeQuery],
  );

  /**
   * Toggle the open state of the workflow AI sidebar.
   */
  const toggleOpen = useCallback(() => {
    setOpen(!isOpen);
  }, [isOpen, setOpen]);

  /**
   * Set the mode of the workflow AI sidebar.
   * 'draft' is the default, so we only store 'analysis' in the URL.
   */
  const setMode = useCallback(
    (newMode: WorkflowAIMode) => {
      // Only store non-default mode in URL for cleaner URLs
      setModeQuery(newMode === 'draft' ? null : newMode).catch(console.error);
    },
    [setModeQuery],
  );

  return {
    isOpen,
    mode,
    setOpen,
    setMode,
    toggleOpen,
  };
}
