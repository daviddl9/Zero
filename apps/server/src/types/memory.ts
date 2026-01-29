/**
 * Memory types for AI Draft Learning feature
 * These types define the structure for storing and retrieving user preferences,
 * corrections, and learning data for personalized email drafting.
 */

// Re-export from schema for convenience
export type { Memory, NewMemory, MemoryCategory, MemoryMetadata, MemoryAnalytics } from '../db/schema';

/**
 * Parameters for adding a new memory
 */
export interface AddMemoryParams {
  userId: string;
  connectionId?: string;
  content: string;
  metadata: import('../db/schema').MemoryMetadata;
  recipientEmail?: string;
  recipientDomain?: string;
  category?: import('../db/schema').MemoryCategory;
}

/**
 * Parameters for searching memories
 */
export interface SearchMemoryParams {
  userId: string;
  query: string;
  recipientEmail?: string;
  recipientDomain?: string;
  limit?: number; // Default: 10
  threshold?: number; // Default: 0.7 similarity threshold
}

/**
 * Parameters for recording a correction (user edit to AI draft)
 */
export interface CorrectionParams {
  userId: string;
  connectionId: string;
  originalDraft: string;
  editedDraft: string;
  recipientEmail: string;
  subjectKeywords: string[];
}

/**
 * Parameters for recording draft selection
 */
export interface DraftSelectionParams {
  userId: string;
  connectionId: string;
  selectedApproach: string;
  rejectedApproaches: string[];
  recipientEmail: string;
  context: {
    subject: string;
    threadDepth: number;
  };
}

/**
 * Parameters for getting memories for compose
 */
export interface ComposeContextParams {
  userId: string;
  recipientEmail?: string;
  query: string;
  limit?: number;
}

/**
 * Memory search result with score
 */
export interface MemorySearchResult {
  id: string;
  content: string;
  category: import('../db/schema').MemoryCategory;
  recipientEmail?: string | null;
  recipientDomain?: string | null;
  weight: number | null;
  metadata: import('../db/schema').MemoryMetadata | null;
  score?: number; // Similarity score from vector search
  createdAt: Date;
  updatedAt: Date;
}
