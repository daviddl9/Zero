/**
 * MemoryService - AI Draft Learning Memory System
 *
 * This service provides persistent memory for AI email drafting,
 * learning from user corrections, preferences, and draft selections
 * to improve draft quality over time.
 */

import { eq, and, desc, sql, count } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { memory, type Memory, type MemoryCategory, type MemoryMetadata } from '../db/schema';
import type {
  AddMemoryParams,
  SearchMemoryParams,
  CorrectionParams,
  DraftSelectionParams,
  ComposeContextParams,
  MemorySearchResult,
} from '../types/memory';
import type { MemoryAnalytics } from '../db/schema';
import { createDb } from '../db';
import { env } from '../env';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';
import { distance as levenshtein } from 'fastest-levenshtein';

// Configuration
const EMBEDDING_MODEL = 'text-embedding-ada-002';
const DEFAULT_SEARCH_LIMIT = 10;
const DEFAULT_SIMILARITY_THRESHOLD = 0.7;

/**
 * MemoryService class for managing AI draft learning memories
 */
export class MemoryService {
  private memoryEnabled: boolean = true;

  constructor() {
    // Memory is enabled by default, can be disabled via env
    this.memoryEnabled = env.MEMORY_ENABLED !== false;

    if (!this.memoryEnabled) {
      console.log('[MemoryService] Memory feature is disabled');
    }
  }

  /**
   * Check if memory feature is enabled
   */
  isEnabled(): boolean {
    return this.memoryEnabled;
  }

  /**
   * Generate embedding for text using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.memoryEnabled) return null;

    try {
      const { embedding } = await embed({
        model: openai.embedding(EMBEDDING_MODEL),
        value: text,
      });
      return embedding;
    } catch (error) {
      console.error('[MemoryService] Failed to generate embedding:', error);
      return null;
    }
  }

  /**
   * Extract domain from email address
   */
  private extractDomain(email: string): string | null {
    const match = email.match(/@([^@]+)$/);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * Add a new memory
   */
  async addMemory(params: AddMemoryParams): Promise<Memory | null> {
    if (!this.memoryEnabled) return null;

    const { db, conn } = createDb(env.HYPERDRIVE.connectionString);

    try {
      const embedding = await this.generateEmbedding(params.content);
      const recipientDomain = params.recipientEmail
        ? this.extractDomain(params.recipientEmail)
        : params.recipientDomain;

      const newMemory: typeof memory.$inferInsert = {
        id: createId(),
        userId: params.userId,
        connectionId: params.connectionId,
        content: params.content,
        embedding,
        category: params.category || 'preference',
        recipientEmail: params.recipientEmail,
        recipientDomain: recipientDomain,
        weight: 1.0,
        metadata: params.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const [result] = await db.insert(memory).values(newMemory).returning();
      return result;
    } catch (error) {
      console.error('[MemoryService] Failed to add memory:', error);
      return null;
    } finally {
      await conn.end();
    }
  }

  /**
   * Search memories using vector similarity
   */
  async searchMemories(params: SearchMemoryParams): Promise<MemorySearchResult[]> {
    if (!this.memoryEnabled) return [];

    const { db, conn } = createDb(env.HYPERDRIVE.connectionString);

    try {
      const queryEmbedding = await this.generateEmbedding(params.query);
      const limit = params.limit ?? DEFAULT_SEARCH_LIMIT;
      const threshold = params.threshold ?? DEFAULT_SIMILARITY_THRESHOLD;

      // Build conditions
      const conditions = [eq(memory.userId, params.userId)];

      if (params.recipientEmail) {
        conditions.push(eq(memory.recipientEmail, params.recipientEmail));
      }

      if (params.recipientDomain) {
        conditions.push(eq(memory.recipientDomain, params.recipientDomain));
      }

      // If we have an embedding, use vector similarity search
      if (queryEmbedding) {
        const embeddingStr = `[${queryEmbedding.join(',')}]`;

        const results = await db
          .select({
            id: memory.id,
            content: memory.content,
            category: memory.category,
            recipientEmail: memory.recipientEmail,
            recipientDomain: memory.recipientDomain,
            weight: memory.weight,
            metadata: memory.metadata,
            createdAt: memory.createdAt,
            updatedAt: memory.updatedAt,
            score: sql<number>`1 - (${memory.embedding} <=> ${embeddingStr}::vector)`.as('score'),
          })
          .from(memory)
          .where(and(...conditions))
          .orderBy(sql`${memory.embedding} <=> ${embeddingStr}::vector`)
          .limit(limit);

        // Filter by threshold and cast types
        return results
          .filter((r) => r.score >= threshold)
          .map((r) => ({
            ...r,
            category: r.category as MemoryCategory,
            score: r.score,
          }));
      }

      // Fallback: text-based search without embeddings
      const results = await db
        .select()
        .from(memory)
        .where(and(...conditions))
        .orderBy(desc(memory.updatedAt))
        .limit(limit);

      return results.map((r) => ({
        ...r,
        category: r.category as MemoryCategory,
        score: 1.0,
      }));
    } catch (error) {
      console.error('[MemoryService] Failed to search memories:', error);
      return [];
    } finally {
      await conn.end();
    }
  }

  /**
   * Get a single memory by ID
   */
  async getMemory(memoryId: string, userId: string): Promise<Memory | null> {
    if (!this.memoryEnabled) return null;

    const { db, conn } = createDb(env.HYPERDRIVE.connectionString);

    try {
      const [result] = await db
        .select()
        .from(memory)
        .where(and(eq(memory.id, memoryId), eq(memory.userId, userId)));

      return result || null;
    } catch (error) {
      console.error('[MemoryService] Failed to get memory:', error);
      return null;
    } finally {
      await conn.end();
    }
  }

  /**
   * Update a memory's content
   */
  async updateMemory(memoryId: string, userId: string, content: string): Promise<boolean> {
    if (!this.memoryEnabled) return false;

    const { db, conn } = createDb(env.HYPERDRIVE.connectionString);

    try {
      const embedding = await this.generateEmbedding(content);

      await db
        .update(memory)
        .set({
          content,
          embedding,
          updatedAt: new Date(),
        })
        .where(and(eq(memory.id, memoryId), eq(memory.userId, userId)));

      return true;
    } catch (error) {
      console.error('[MemoryService] Failed to update memory:', error);
      return false;
    } finally {
      await conn.end();
    }
  }

  /**
   * Delete a memory
   */
  async deleteMemory(memoryId: string, userId: string): Promise<boolean> {
    if (!this.memoryEnabled) return false;

    const { db, conn } = createDb(env.HYPERDRIVE.connectionString);

    try {
      await db
        .delete(memory)
        .where(and(eq(memory.id, memoryId), eq(memory.userId, userId)));

      return true;
    } catch (error) {
      console.error('[MemoryService] Failed to delete memory:', error);
      return false;
    } finally {
      await conn.end();
    }
  }

  /**
   * Delete all memories for a user
   */
  async deleteAllMemories(userId: string): Promise<boolean> {
    if (!this.memoryEnabled) return false;

    const { db, conn } = createDb(env.HYPERDRIVE.connectionString);

    try {
      await db.delete(memory).where(eq(memory.userId, userId));
      return true;
    } catch (error) {
      console.error('[MemoryService] Failed to delete all memories:', error);
      return false;
    } finally {
      await conn.end();
    }
  }

  /**
   * Record a correction (user edit to AI draft)
   */
  async recordCorrection(params: CorrectionParams): Promise<Memory | null> {
    if (!this.memoryEnabled) return null;

    const { originalDraft, editedDraft } = params;

    // Calculate change percentage using Levenshtein distance
    const maxLength = Math.max(originalDraft.length, editedDraft.length);
    if (maxLength === 0) return null;

    const distance = levenshtein(originalDraft, editedDraft);
    const changePercentage = (distance / maxLength) * 100;

    // Skip if no change
    if (changePercentage === 0) return null;

    // Determine correction type
    let correctionType: 'minor_tweak' | 'major_rewrite' | 'replacement';
    if (changePercentage < 20) {
      correctionType = 'minor_tweak';
    } else if (changePercentage < 80) {
      correctionType = 'major_rewrite';
    } else {
      correctionType = 'replacement';
    }

    // Build a description of the correction for learning
    const correctionDescription = this.buildCorrectionDescription(
      originalDraft,
      editedDraft,
      correctionType,
    );

    const metadata: MemoryMetadata = {
      source: 'correction',
      correctionType,
      changePercentage,
      subjectKeywords: params.subjectKeywords,
    };

    return this.addMemory({
      userId: params.userId,
      connectionId: params.connectionId,
      content: correctionDescription,
      recipientEmail: params.recipientEmail,
      category: 'correction',
      metadata,
    });
  }

  /**
   * Build a description of the correction for memory storage
   */
  private buildCorrectionDescription(
    original: string,
    edited: string,
    correctionType: string,
  ): string {
    // Check for greeting changes
    const originalGreeting = this.extractGreeting(original);
    const editedGreeting = this.extractGreeting(edited);
    if (originalGreeting !== editedGreeting && editedGreeting) {
      return `User prefers greeting: "${editedGreeting}" instead of "${originalGreeting || 'none'}"`;
    }

    // Check for sign-off changes
    const originalSignoff = this.extractSignoff(original);
    const editedSignoff = this.extractSignoff(edited);
    if (originalSignoff !== editedSignoff && editedSignoff) {
      return `User prefers sign-off: "${editedSignoff}" instead of "${originalSignoff || 'none'}"`;
    }

    // Check for tone/length preference
    if (edited.length < original.length * 0.7) {
      return 'User prefers more concise emails';
    }
    if (edited.length > original.length * 1.3) {
      return 'User prefers more detailed emails';
    }

    // Default: describe the correction type
    if (correctionType === 'minor_tweak') {
      return `User made minor adjustments to the draft (tone/wording refinement)`;
    } else if (correctionType === 'major_rewrite') {
      return `User significantly rewrote the draft (different approach preferred)`;
    } else {
      return `User replaced the draft entirely (different style preferred)`;
    }
  }

  /**
   * Extract greeting from email text
   */
  private extractGreeting(text: string): string | null {
    const firstLine = text.split('\n')[0]?.trim().toLowerCase();
    if (!firstLine) return null;

    const greetings = ['hi', 'hey', 'hello', 'dear', 'good morning', 'good afternoon', 'good evening'];
    for (const g of greetings) {
      if (firstLine.startsWith(g)) {
        return firstLine.split(',')[0] || firstLine;
      }
    }
    return null;
  }

  /**
   * Extract sign-off from email text
   */
  private extractSignoff(text: string): string | null {
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length < 2) return null;

    const lastFewLines = lines.slice(-3).map((l) => l.trim().toLowerCase());
    const signoffs = ['best', 'regards', 'thanks', 'cheers', 'sincerely', 'warm regards', 'kind regards'];

    for (const line of lastFewLines) {
      for (const s of signoffs) {
        if (line.startsWith(s)) {
          return line.replace(/,?\s*$/, '');
        }
      }
    }
    return null;
  }

  /**
   * Record draft selection (which draft option user chose)
   */
  async recordDraftSelection(params: DraftSelectionParams): Promise<Memory | null> {
    if (!this.memoryEnabled) return null;

    const { db, conn } = createDb(env.HYPERDRIVE.connectionString);

    try {
      // Check for existing selection memories with same approach
      const existingMemories = await db
        .select()
        .from(memory)
        .where(
          and(
            eq(memory.userId, params.userId),
            eq(memory.category, 'selection'),
            sql`${memory.metadata}->>'selectedApproach' = ${params.selectedApproach}`,
          ),
        );

      // Calculate reinforcement count
      const reinforcementCount = existingMemories.length + 1;

      const metadata: MemoryMetadata = {
        source: 'selection',
        selectedApproach: params.selectedApproach,
        rejectedApproaches: params.rejectedApproaches,
        subjectKeywords: [params.context.subject],
        threadDepth: params.context.threadDepth,
        reinforcementCount,
        lastReinforcedAt: new Date().toISOString(),
      };

      const content = `User prefers "${params.selectedApproach}" approach${
        reinforcementCount > 1 ? ` (selected ${reinforcementCount} times)` : ''
      }`;

      return this.addMemory({
        userId: params.userId,
        connectionId: params.connectionId,
        content,
        recipientEmail: params.recipientEmail,
        category: 'selection',
        metadata,
      });
    } catch (error) {
      console.error('[MemoryService] Failed to record draft selection:', error);
      return null;
    } finally {
      await conn.end();
    }
  }

  /**
   * Get memories for composing an email
   * Prioritizes: person-specific > domain-specific > general
   */
  async getMemoriesForCompose(params: ComposeContextParams): Promise<MemorySearchResult[]> {
    if (!this.memoryEnabled) return [];

    const { userId, recipientEmail, query, limit = DEFAULT_SEARCH_LIMIT } = params;
    const domain = recipientEmail ? this.extractDomain(recipientEmail) : null;

    const allMemories: MemorySearchResult[] = [];

    // 1. Person-specific memories (highest priority)
    if (recipientEmail) {
      const personMemories = await this.searchMemories({
        userId,
        query,
        recipientEmail,
        limit: limit / 3,
      });
      allMemories.push(...personMemories.map((m) => ({ ...m, weight: (m.weight ?? 1) * 1.5 })));
    }

    // 2. Domain-specific memories
    if (domain) {
      const domainMemories = await this.searchMemories({
        userId,
        query,
        recipientDomain: domain,
        limit: limit / 3,
      });
      // Avoid duplicates
      const existingIds = new Set(allMemories.map((m) => m.id));
      allMemories.push(
        ...domainMemories
          .filter((m) => !existingIds.has(m.id))
          .map((m) => ({ ...m, weight: (m.weight ?? 1) * 1.2 })),
      );
    }

    // 3. General memories (lowest priority)
    const generalMemories = await this.searchMemories({
      userId,
      query,
      limit: limit / 2,
    });
    const existingIds = new Set(allMemories.map((m) => m.id));
    allMemories.push(...generalMemories.filter((m) => !existingIds.has(m.id)));

    // Sort by weighted score and return top N
    return allMemories
      .sort((a, b) => {
        const scoreA = (a.score ?? 0) * (a.weight ?? 1);
        const scoreB = (b.score ?? 0) * (b.weight ?? 1);
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }

  /**
   * Get analytics for user's memories
   */
  async getAnalytics(userId: string): Promise<MemoryAnalytics | null> {
    if (!this.memoryEnabled) return null;

    const { db, conn } = createDb(env.HYPERDRIVE.connectionString);

    try {
      // Get total count
      const [totalResult] = await db
        .select({ count: count() })
        .from(memory)
        .where(eq(memory.userId, userId));

      // Get counts by category
      const categoryResults = await db
        .select({
          category: memory.category,
          count: count(),
        })
        .from(memory)
        .where(eq(memory.userId, userId))
        .groupBy(memory.category);

      // Get counts by scope
      const [generalCount] = await db
        .select({ count: count() })
        .from(memory)
        .where(
          and(
            eq(memory.userId, userId),
            sql`${memory.recipientEmail} IS NULL AND ${memory.recipientDomain} IS NULL`,
          ),
        );

      const [domainCount] = await db
        .select({ count: count() })
        .from(memory)
        .where(
          and(
            eq(memory.userId, userId),
            sql`${memory.recipientEmail} IS NULL AND ${memory.recipientDomain} IS NOT NULL`,
          ),
        );

      const [personCount] = await db
        .select({ count: count() })
        .from(memory)
        .where(and(eq(memory.userId, userId), sql`${memory.recipientEmail} IS NOT NULL`));

      // Get recent learnings
      const recentLearnings = await db
        .select({
          id: memory.id,
          content: memory.content,
          category: memory.category,
          createdAt: memory.createdAt,
        })
        .from(memory)
        .where(eq(memory.userId, userId))
        .orderBy(desc(memory.createdAt))
        .limit(10);

      // Get top domains
      const topDomains = await db
        .select({
          domain: memory.recipientDomain,
          count: count(),
        })
        .from(memory)
        .where(and(eq(memory.userId, userId), sql`${memory.recipientDomain} IS NOT NULL`))
        .groupBy(memory.recipientDomain)
        .orderBy(desc(count()))
        .limit(5);

      // Build category counts object
      const memoriesByCategory = {
        preference: 0,
        correction: 0,
        selection: 0,
      };
      for (const r of categoryResults) {
        if (r.category in memoriesByCategory) {
          memoriesByCategory[r.category as MemoryCategory] = r.count;
        }
      }

      return {
        totalMemories: totalResult?.count ?? 0,
        memoriesByCategory,
        memoriesByScope: {
          general: generalCount?.count ?? 0,
          domainSpecific: domainCount?.count ?? 0,
          personSpecific: personCount?.count ?? 0,
        },
        recentLearnings: recentLearnings.map((r) => ({
          ...r,
          category: r.category as MemoryCategory,
        })),
        topDomains: topDomains
          .filter((d) => d.domain)
          .map((d) => ({
            domain: d.domain!,
            count: d.count,
          })),
      };
    } catch (error) {
      console.error('[MemoryService] Failed to get analytics:', error);
      return null;
    } finally {
      await conn.end();
    }
  }
}

// Export singleton instance
export const memoryService = new MemoryService();
