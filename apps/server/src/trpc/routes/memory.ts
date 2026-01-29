/**
 * Memory tRPC Router - API for AI Draft Learning Memory
 *
 * Provides endpoints for managing user preferences, corrections,
 * and learning data for personalized email drafting.
 */

import { privateProcedure, router } from '../trpc';
import { memoryService } from '../../services/memory-service';
import { z } from 'zod';
import type { MemoryMetadata } from '../../db/schema';

// Zod schemas for memory operations
const MemoryCategorySchema = z.enum(['preference', 'correction', 'selection']);

const AddPreferenceSchema = z.object({
  content: z.string().min(1).max(5000),
  recipientEmail: z.string().email().optional(),
  recipientDomain: z.string().optional(),
  connectionId: z.string().optional(),
});

const ListPreferencesSchema = z.object({
  category: MemoryCategorySchema.optional(),
  recipientDomain: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
});

const UpdatePreferenceSchema = z.object({
  memoryId: z.string(),
  content: z.string().min(1).max(5000),
});

const CorrectionSchema = z.object({
  originalDraft: z.string(),
  editedDraft: z.string(),
  recipientEmail: z.string().email(),
  subjectKeywords: z.array(z.string()),
  connectionId: z.string().optional(),
});

const SelectionSchema = z.object({
  selectedApproach: z.string(),
  rejectedApproaches: z.array(z.string()),
  recipientEmail: z.string().email(),
  context: z.object({
    subject: z.string(),
    threadDepth: z.number(),
  }),
  connectionId: z.string().optional(),
});

const SearchMemoriesSchema = z.object({
  query: z.string(),
  recipientEmail: z.string().email().optional(),
  recipientDomain: z.string().optional(),
  limit: z.number().min(1).max(50).optional(),
  threshold: z.number().min(0).max(1).optional(),
});

export const memoryRouter = router({
  /**
   * Check if memory feature is enabled
   */
  isEnabled: privateProcedure.query(async () => {
    return { enabled: memoryService.isEnabled() };
  }),

  /**
   * Add a new preference memory
   */
  addPreference: privateProcedure.input(AddPreferenceSchema).mutation(async ({ ctx, input }) => {
    const metadata: MemoryMetadata = {
      source: 'explicit',
    };

    const memory = await memoryService.addMemory({
      userId: ctx.sessionUser.id,
      connectionId: input.connectionId,
      content: input.content,
      recipientEmail: input.recipientEmail,
      recipientDomain: input.recipientDomain,
      category: 'preference',
      metadata,
    });

    return { memory };
  }),

  /**
   * List user's memories with optional filtering
   */
  listPreferences: privateProcedure.input(ListPreferencesSchema).query(async ({ ctx, input }) => {
    const memories = await memoryService.searchMemories({
      userId: ctx.sessionUser.id,
      query: '', // Empty query returns all
      recipientDomain: input.recipientDomain,
      limit: input.limit ?? 50,
      threshold: 0, // Return all regardless of score
    });

    // Filter by category if specified
    const filtered = input.category
      ? memories.filter((m) => m.category === input.category)
      : memories;

    return { memories: filtered };
  }),

  /**
   * Search memories semantically
   */
  search: privateProcedure.input(SearchMemoriesSchema).query(async ({ ctx, input }) => {
    const memories = await memoryService.searchMemories({
      userId: ctx.sessionUser.id,
      query: input.query,
      recipientEmail: input.recipientEmail,
      recipientDomain: input.recipientDomain,
      limit: input.limit,
      threshold: input.threshold,
    });

    return { memories };
  }),

  /**
   * Get a single memory by ID
   */
  get: privateProcedure.input(z.object({ memoryId: z.string() })).query(async ({ ctx, input }) => {
    const memory = await memoryService.getMemory(input.memoryId, ctx.sessionUser.id);
    return { memory };
  }),

  /**
   * Update a memory's content
   */
  updatePreference: privateProcedure
    .input(UpdatePreferenceSchema)
    .mutation(async ({ ctx, input }) => {
      const success = await memoryService.updateMemory(
        input.memoryId,
        ctx.sessionUser.id,
        input.content,
      );
      return { success };
    }),

  /**
   * Delete a memory
   */
  deletePreference: privateProcedure
    .input(z.object({ memoryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const success = await memoryService.deleteMemory(input.memoryId, ctx.sessionUser.id);
      return { success };
    }),

  /**
   * Record a correction (user edit to AI draft)
   * Called automatically when user sends an edited AI draft
   */
  recordCorrection: privateProcedure.input(CorrectionSchema).mutation(async ({ ctx, input }) => {
    const memory = await memoryService.recordCorrection({
      userId: ctx.sessionUser.id,
      connectionId: input.connectionId ?? '',
      originalDraft: input.originalDraft,
      editedDraft: input.editedDraft,
      recipientEmail: input.recipientEmail,
      subjectKeywords: input.subjectKeywords,
    });

    return { memory, recorded: !!memory };
  }),

  /**
   * Record draft selection (which draft option user chose)
   * Called when user selects one of multiple draft options
   */
  recordSelection: privateProcedure.input(SelectionSchema).mutation(async ({ ctx, input }) => {
    const memory = await memoryService.recordDraftSelection({
      userId: ctx.sessionUser.id,
      connectionId: input.connectionId ?? '',
      selectedApproach: input.selectedApproach,
      rejectedApproaches: input.rejectedApproaches,
      recipientEmail: input.recipientEmail,
      context: input.context,
    });

    return { memory, recorded: !!memory };
  }),

  /**
   * Get memory analytics for the user
   */
  getAnalytics: privateProcedure.query(async ({ ctx }) => {
    const analytics = await memoryService.getAnalytics(ctx.sessionUser.id);
    return { analytics };
  }),

  /**
   * Clear all memories for the user
   * Requires explicit confirmation
   */
  clearAllMemories: privateProcedure
    .input(z.object({ confirm: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      if (!input.confirm) {
        return { success: false, error: 'Confirmation required' };
      }

      const success = await memoryService.deleteAllMemories(ctx.sessionUser.id);
      return { success };
    }),

  /**
   * Get memories for composing an email
   * Used by the AI compose system to personalize drafts
   */
  getForCompose: privateProcedure
    .input(
      z.object({
        recipientEmail: z.string().email().optional(),
        query: z.string(),
        limit: z.number().min(1).max(20).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const memories = await memoryService.getMemoriesForCompose({
        userId: ctx.sessionUser.id,
        recipientEmail: input.recipientEmail,
        query: input.query,
        limit: input.limit,
      });

      return { memories };
    }),
});
