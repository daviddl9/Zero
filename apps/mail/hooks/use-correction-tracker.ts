/**
 * Hook for tracking user corrections to AI-generated drafts
 *
 * This hook detects when a user edits an AI draft and calculates
 * the significance of the changes for learning purposes.
 */

import { useRef, useCallback } from 'react';
import { useLearningMutations } from './use-memories';

export interface CorrectionResult {
  originalDraft: string;
  editedDraft: string;
  changePercentage: number;
  isSignificant: boolean; // < 20% change = significant correction worth learning
  correctionType: 'minor_tweak' | 'major_rewrite' | 'replacement';
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create a 2D array to store distances
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize base cases
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  // Fill in the rest of the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!;
      } else {
        dp[i]![j] = 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
      }
    }
  }

  return dp[m]![n]!;
}

/**
 * Hook for tracking corrections to AI drafts
 */
export function useCorrectionTracker() {
  const originalDraftRef = useRef<string | null>(null);
  const { recordCorrection } = useLearningMutations();

  /**
   * Track the original AI-generated draft
   * Call this when an AI draft is received
   */
  const trackAiDraft = useCallback((draft: string) => {
    originalDraftRef.current = draft;
  }, []);

  /**
   * Clear the tracked draft (e.g., when composing a new email)
   */
  const clearTracking = useCallback(() => {
    originalDraftRef.current = null;
  }, []);

  /**
   * Check if the current content differs from the original AI draft
   * Returns correction details if there are changes
   */
  const checkForCorrections = useCallback((currentContent: string): CorrectionResult | null => {
    const originalDraft = originalDraftRef.current;

    if (!originalDraft) {
      return null;
    }

    // Normalize content for comparison (trim whitespace)
    const normalizedOriginal = originalDraft.trim();
    const normalizedCurrent = currentContent.trim();

    // No changes
    if (normalizedOriginal === normalizedCurrent) {
      return null;
    }

    // Calculate change percentage using Levenshtein distance
    const maxLength = Math.max(normalizedOriginal.length, normalizedCurrent.length);
    if (maxLength === 0) {
      return null;
    }

    const distance = levenshteinDistance(normalizedOriginal, normalizedCurrent);
    const changePercentage = (distance / maxLength) * 100;

    // Determine correction type
    let correctionType: 'minor_tweak' | 'major_rewrite' | 'replacement';
    if (changePercentage < 20) {
      correctionType = 'minor_tweak';
    } else if (changePercentage < 80) {
      correctionType = 'major_rewrite';
    } else {
      correctionType = 'replacement';
    }

    return {
      originalDraft: normalizedOriginal,
      editedDraft: normalizedCurrent,
      changePercentage,
      isSignificant: changePercentage > 0 && changePercentage < 20,
      correctionType,
    };
  }, []);

  /**
   * Submit a correction for learning
   * Call this when the user sends an edited AI draft
   */
  const submitCorrection = useCallback(
    async (params: {
      currentContent: string;
      recipientEmail: string;
      subjectKeywords: string[];
      connectionId?: string;
    }) => {
      const correction = checkForCorrections(params.currentContent);

      if (!correction || correction.changePercentage === 0) {
        return null;
      }

      // Record the correction (fire-and-forget)
      try {
        await recordCorrection.mutateAsync({
          originalDraft: correction.originalDraft,
          editedDraft: correction.editedDraft,
          recipientEmail: params.recipientEmail,
          subjectKeywords: params.subjectKeywords,
          connectionId: params.connectionId,
        });

        // Clear tracking after successful submission
        clearTracking();

        return correction;
      } catch (error) {
        console.warn('[useCorrectionTracker] Failed to submit correction:', error);
        return null;
      }
    },
    [checkForCorrections, recordCorrection, clearTracking],
  );

  /**
   * Check if we're currently tracking an AI draft
   */
  const isTracking = useCallback(() => {
    return originalDraftRef.current !== null;
  }, []);

  return {
    trackAiDraft,
    clearTracking,
    checkForCorrections,
    submitCorrection,
    isTracking,
  };
}

/**
 * Hook for tracking draft selections
 */
export function useSelectionTracker() {
  const { recordSelection } = useLearningMutations();

  /**
   * Record when a user selects a draft from multiple options
   */
  const trackSelection = useCallback(
    async (params: {
      selectedApproach: string;
      rejectedApproaches: string[];
      recipientEmail: string;
      subject: string;
      threadDepth: number;
      connectionId?: string;
    }) => {
      try {
        await recordSelection.mutateAsync({
          selectedApproach: params.selectedApproach,
          rejectedApproaches: params.rejectedApproaches,
          recipientEmail: params.recipientEmail,
          context: {
            subject: params.subject,
            threadDepth: params.threadDepth,
          },
          connectionId: params.connectionId,
        });
      } catch (error) {
        console.warn('[useSelectionTracker] Failed to track selection:', error);
      }
    },
    [recordSelection],
  );

  return {
    trackSelection,
  };
}
