/**
 * Skills Service - manages AI copilot skills stored in the database.
 * Skills are reusable prompt fragments that enhance the AI's capabilities for specific tasks.
 */

import { eq, and, or, isNull, asc } from 'drizzle-orm';
import { skill, skillReference } from '../../db/schema';
import type { DB } from '../../db';

export interface Skill {
  id: string;
  userId: string;
  connectionId: string | null;
  name: string;
  description: string | null;
  content: string;
  category: string | null;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillSummary {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
}

export interface SkillReference {
  id: string;
  skillId: string;
  name: string;
  content: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSkillInput {
  name: string;
  description?: string;
  content: string;
  category?: string;
  connectionId?: string;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  content?: string;
  category?: string;
  isEnabled?: boolean;
}

export class SkillsService {
  constructor(
    private db: DB,
    private userId: string,
    private connectionId?: string,
  ) {}

  /**
   * List all skills available to the user (enabled only).
   * Returns both user-level skills (connectionId = null) and connection-specific skills.
   */
  async listSkills(): Promise<Skill[]> {
    const conditions = this.connectionId
      ? or(
          and(eq(skill.userId, this.userId), isNull(skill.connectionId)),
          and(eq(skill.userId, this.userId), eq(skill.connectionId, this.connectionId)),
        )
      : and(eq(skill.userId, this.userId), isNull(skill.connectionId));

    const results = await this.db
      .select()
      .from(skill)
      .where(and(conditions, eq(skill.isEnabled, true)));

    return results as Skill[];
  }

  /**
   * List all skills for management UI (includes disabled skills).
   * Returns all user-level skills regardless of enabled status.
   */
  async listAllSkills(): Promise<Skill[]> {
    const results = await this.db
      .select()
      .from(skill)
      .where(eq(skill.userId, this.userId))
      .orderBy(skill.name);

    return results as Skill[];
  }

  /**
   * List skills as summaries (for system prompt injection).
   */
  async listSkillSummaries(): Promise<SkillSummary[]> {
    const skills = await this.listSkills();
    return skills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      category: s.category,
    }));
  }

  /**
   * Get a specific skill by ID or name.
   */
  async getSkill(identifier: string): Promise<Skill | null> {
    // Try by ID first
    let result = await this.db.select().from(skill).where(eq(skill.id, identifier)).limit(1);

    if (result.length === 0) {
      // Try by name (for this user)
      result = await this.db
        .select()
        .from(skill)
        .where(and(eq(skill.userId, this.userId), eq(skill.name, identifier)))
        .limit(1);
    }

    return (result[0] as Skill) || null;
  }

  /**
   * Create a new skill.
   */
  async createSkill(input: CreateSkillInput): Promise<Skill> {
    const now = new Date();
    const newSkill = {
      id: crypto.randomUUID(),
      userId: this.userId,
      connectionId: input.connectionId || null,
      name: input.name,
      description: input.description || null,
      content: input.content,
      category: input.category || null,
      isEnabled: true,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(skill).values(newSkill);
    return newSkill as Skill;
  }

  /**
   * Update an existing skill.
   */
  async updateSkill(id: string, input: UpdateSkillInput): Promise<Skill | null> {
    const existing = await this.getSkill(id);
    if (!existing || existing.userId !== this.userId) {
      return null;
    }

    const updates: Partial<Skill> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.content !== undefined) updates.content = input.content;
    if (input.category !== undefined) updates.category = input.category;
    if (input.isEnabled !== undefined) updates.isEnabled = input.isEnabled;

    await this.db.update(skill).set(updates).where(eq(skill.id, id));

    return this.getSkill(id);
  }

  /**
   * Delete a skill.
   */
  async deleteSkill(id: string): Promise<boolean> {
    const existing = await this.getSkill(id);
    if (!existing || existing.userId !== this.userId) {
      return false;
    }

    await this.db.delete(skill).where(eq(skill.id, id));
    return true;
  }

  /**
   * Format skills for system prompt injection.
   */
  formatSkillsForPrompt(skills: SkillSummary[]): string {
    if (skills.length === 0) return '';

    const lines = skills.map((s) => {
      const desc = s.description ? `: ${s.description}` : '';
      const cat = s.category ? ` [${s.category}]` : '';
      return `- **${s.name}**${cat}${desc}`;
    });

    return `## Available Skills

The following skills are available. Use the readSkill tool to load a skill's full instructions when handling a task that matches its description.

${lines.join('\n')}`;
  }

  /**
   * List all references for a skill.
   */
  async listSkillReferences(skillId: string): Promise<SkillReference[]> {
    // Verify the skill belongs to this user
    const skillRecord = await this.getSkill(skillId);
    if (!skillRecord) return [];

    const results = await this.db
      .select()
      .from(skillReference)
      .where(eq(skillReference.skillId, skillId))
      .orderBy(asc(skillReference.order));

    return results as SkillReference[];
  }

  /**
   * Get reference names for a skill (for inclusion in readSkill response).
   */
  async getSkillReferenceNames(skillId: string): Promise<string[]> {
    const refs = await this.listSkillReferences(skillId);
    return refs.map((r) => r.name);
  }

  /**
   * Get a specific reference by skill ID and reference name.
   */
  async getSkillReference(skillId: string, referenceName: string): Promise<SkillReference | null> {
    // Verify the skill belongs to this user
    const skillRecord = await this.getSkill(skillId);
    if (!skillRecord) return null;

    const result = await this.db
      .select()
      .from(skillReference)
      .where(
        and(
          eq(skillReference.skillId, skillId),
          eq(skillReference.name, referenceName),
        ),
      )
      .limit(1);

    return (result[0] as SkillReference) || null;
  }
}
