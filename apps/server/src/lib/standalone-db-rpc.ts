/**
 * Standalone Database RPC
 *
 * Provides the same interface as DbRpcDO from main.ts but uses direct
 * drizzle queries instead of Cloudflare Durable Objects.
 */

import {
  user,
  connection,
  note,
  userSettings,
  userHotkeys,
  writingStyleMatrix,
  emailTemplate,
  skill,
  skillReference,
  account,
  session,
  workflow,
  workflowExecution,
} from '../db/schema';
import {
  createUpdatedMatrixFromNewEmail,
  initializeStyleMatrixFromEmail,
  type EmailMatrix,
  type WritingStyleMatrix,
} from '../services/writing-style-service';
import type {
  WorkflowNode,
  WorkflowConnections,
  WorkflowSettings,
  ExecutionStatus,
  TriggerData,
  NodeExecutionResult,
} from '../lib/workflow-engine/types';
import { defaultUserSettings } from './schemas';
import { eq, and, desc, asc, inArray } from 'drizzle-orm';
import type { EProviders } from '../types';
import type { DB } from '../db';

/**
 * Standalone Database RPC class
 *
 * Provides the same interface as DbRpcDO but uses direct drizzle queries.
 * This allows tRPC routers to work without modification in standalone mode.
 */
export class StandaloneDbRpc {
  constructor(
    private db: DB,
    private userId: string,
  ) {}

  async findUser(): Promise<typeof user.$inferSelect | undefined> {
    return await this.db.query.user.findFirst({
      where: eq(user.id, this.userId),
    });
  }

  async findUserConnection(
    connectionId: string,
  ): Promise<typeof connection.$inferSelect | undefined> {
    return await this.db.query.connection.findFirst({
      where: and(eq(connection.userId, this.userId), eq(connection.id, connectionId)),
    });
  }

  async updateUser(data: Partial<typeof user.$inferInsert>) {
    return await this.db.update(user).set(data).where(eq(user.id, this.userId));
  }

  async deleteConnection(connectionId: string) {
    const connections = await this.findManyConnections();
    if (connections.length <= 1) {
      throw new Error('Cannot delete the last connection. At least one connection is required.');
    }
    return await this.db
      .delete(connection)
      .where(and(eq(connection.id, connectionId), eq(connection.userId, this.userId)));
  }

  async findFirstConnection(): Promise<typeof connection.$inferSelect | undefined> {
    return await this.db.query.connection.findFirst({
      where: eq(connection.userId, this.userId),
    });
  }

  async findManyConnections(): Promise<(typeof connection.$inferSelect)[]> {
    return await this.db.query.connection.findMany({
      where: eq(connection.userId, this.userId),
    });
  }

  async findManyNotesByThreadId(threadId: string): Promise<(typeof note.$inferSelect)[]> {
    return await this.db.query.note.findMany({
      where: and(eq(note.userId, this.userId), eq(note.threadId, threadId)),
      orderBy: [desc(note.isPinned), asc(note.order), desc(note.createdAt)],
    });
  }

  async createNote(payload: Omit<typeof note.$inferInsert, 'userId'>) {
    return await this.db
      .insert(note)
      .values({
        ...payload,
        userId: this.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
  }

  async updateNote(
    noteId: string,
    payload: Partial<typeof note.$inferInsert>,
  ): Promise<typeof note.$inferSelect | undefined> {
    const [updated] = await this.db
      .update(note)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(and(eq(note.id, noteId), eq(note.userId, this.userId)))
      .returning();
    return updated;
  }

  async updateManyNotes(
    notes: { id: string; order: number; isPinned?: boolean | null }[],
  ): Promise<boolean> {
    return await this.db.transaction(async (tx) => {
      for (const n of notes) {
        const updateData: Record<string, unknown> = {
          order: n.order,
          updatedAt: new Date(),
        };

        if (n.isPinned !== undefined) {
          updateData.isPinned = n.isPinned;
        }
        await tx
          .update(note)
          .set(updateData)
          .where(and(eq(note.id, n.id), eq(note.userId, this.userId)));
      }
      return true;
    });
  }

  async findManyNotesByIds(noteIds: string[]): Promise<(typeof note.$inferSelect)[]> {
    return await this.db.query.note.findMany({
      where: and(eq(note.userId, this.userId), inArray(note.id, noteIds)),
    });
  }

  async deleteNote(noteId: string) {
    return await this.db.delete(note).where(and(eq(note.id, noteId), eq(note.userId, this.userId)));
  }

  async findNoteById(noteId: string): Promise<typeof note.$inferSelect | undefined> {
    return await this.db.query.note.findFirst({
      where: and(eq(note.id, noteId), eq(note.userId, this.userId)),
    });
  }

  async findHighestNoteOrder(): Promise<{ order: number } | undefined> {
    return await this.db.query.note.findFirst({
      where: eq(note.userId, this.userId),
      orderBy: desc(note.order),
      columns: { order: true },
    });
  }

  async deleteUser() {
    return await this.db.transaction(async (tx) => {
      await tx.delete(connection).where(eq(connection.userId, this.userId));
      await tx.delete(account).where(eq(account.userId, this.userId));
      await tx.delete(session).where(eq(session.userId, this.userId));
      await tx.delete(userSettings).where(eq(userSettings.userId, this.userId));
      await tx.delete(user).where(eq(user.id, this.userId));
      await tx.delete(userHotkeys).where(eq(userHotkeys.userId, this.userId));
    });
  }

  async findUserSettings(): Promise<typeof userSettings.$inferSelect | undefined> {
    return await this.db.query.userSettings.findFirst({
      where: eq(userSettings.userId, this.userId),
    });
  }

  async findUserHotkeys(): Promise<(typeof userHotkeys.$inferSelect)[]> {
    return await this.db.query.userHotkeys.findMany({
      where: eq(userHotkeys.userId, this.userId),
    });
  }

  async insertUserHotkeys(shortcuts: (typeof userHotkeys.$inferInsert)[]) {
    return await this.db
      .insert(userHotkeys)
      .values({
        userId: this.userId,
        shortcuts,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userHotkeys.userId,
        set: {
          shortcuts,
          updatedAt: new Date(),
        },
      });
  }

  async insertUserSettings(settings: typeof defaultUserSettings) {
    return await this.db.insert(userSettings).values({
      id: crypto.randomUUID(),
      userId: this.userId,
      settings,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async updateUserSettings(settings: typeof defaultUserSettings) {
    return await this.db
      .insert(userSettings)
      .values({
        id: crypto.randomUUID(),
        userId: this.userId,
        settings,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          settings,
          updatedAt: new Date(),
        },
      });
  }

  async updateEncryptedApiKey(provider: 'openai' | 'gemini', encryptedKey: string | null) {
    const column =
      provider === 'openai' ? userSettings.encryptedOpenaiKey : userSettings.encryptedGeminiKey;

    return await this.db
      .update(userSettings)
      .set({
        [column.name]: encryptedKey,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, this.userId));
  }

  async createConnection(
    providerId: EProviders,
    email: string,
    updatingInfo: {
      expiresAt: Date;
      scope: string;
      name?: string;
      picture?: string;
      accessToken?: string;
      refreshToken?: string;
    },
  ): Promise<{ id: string }[]> {
    return await this.db
      .insert(connection)
      .values({
        ...updatingInfo,
        providerId,
        id: crypto.randomUUID(),
        email,
        userId: this.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [connection.email, connection.userId],
        set: {
          ...updatingInfo,
          updatedAt: new Date(),
        },
      })
      .returning({ id: connection.id });
  }

  async findConnectionById(
    connectionId: string,
  ): Promise<typeof connection.$inferSelect | undefined> {
    return await this.db.query.connection.findFirst({
      where: eq(connection.id, connectionId),
    });
  }

  async syncUserMatrix(connectionId: string, emailStyleMatrix: EmailMatrix) {
    await this.db.transaction(async (tx) => {
      const [existingMatrix] = await tx
        .select({
          numMessages: writingStyleMatrix.numMessages,
          style: writingStyleMatrix.style,
        })
        .from(writingStyleMatrix)
        .where(eq(writingStyleMatrix.connectionId, connectionId));

      if (existingMatrix) {
        const newStyle = createUpdatedMatrixFromNewEmail(
          existingMatrix.numMessages,
          existingMatrix.style as WritingStyleMatrix,
          emailStyleMatrix,
        );

        await tx
          .update(writingStyleMatrix)
          .set({
            numMessages: existingMatrix.numMessages + 1,
            style: newStyle,
          })
          .where(eq(writingStyleMatrix.connectionId, connectionId));
      } else {
        const newStyle = initializeStyleMatrixFromEmail(emailStyleMatrix);

        await tx
          .insert(writingStyleMatrix)
          .values({
            connectionId,
            numMessages: 1,
            style: newStyle,
          })
          .onConflictDoNothing();
      }
    });
  }

  async findWritingStyleMatrix(
    connectionId: string,
  ): Promise<typeof writingStyleMatrix.$inferSelect | undefined> {
    return await this.db.query.writingStyleMatrix.findFirst({
      where: eq(writingStyleMatrix.connectionId, connectionId),
      columns: {
        numMessages: true,
        style: true,
        updatedAt: true,
        connectionId: true,
      },
    });
  }

  async deleteActiveConnection(connectionId: string) {
    return await this.db
      .delete(connection)
      .where(and(eq(connection.userId, this.userId), eq(connection.id, connectionId)));
  }

  async updateConnection(
    connectionId: string,
    updatingInfo: Partial<typeof connection.$inferInsert>,
  ) {
    return await this.db
      .update(connection)
      .set(updatingInfo)
      .where(eq(connection.id, connectionId));
  }

  // Email Templates
  async listEmailTemplates(): Promise<(typeof emailTemplate.$inferSelect)[]> {
    return await this.db.query.emailTemplate.findMany({
      where: eq(emailTemplate.userId, this.userId),
      orderBy: desc(emailTemplate.updatedAt),
    });
  }

  async createEmailTemplate(payload: Omit<typeof emailTemplate.$inferInsert, 'userId'>) {
    return await this.db
      .insert(emailTemplate)
      .values({
        ...payload,
        userId: this.userId,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
  }

  async deleteEmailTemplate(templateId: string) {
    return await this.db
      .delete(emailTemplate)
      .where(and(eq(emailTemplate.id, templateId), eq(emailTemplate.userId, this.userId)));
  }

  async updateEmailTemplate(templateId: string, data: Partial<typeof emailTemplate.$inferInsert>) {
    return await this.db
      .update(emailTemplate)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(emailTemplate.id, templateId), eq(emailTemplate.userId, this.userId)))
      .returning();
  }

  // Skills
  async listAllSkills(): Promise<(typeof skill.$inferSelect)[]> {
    return await this.db.query.skill.findMany({
      where: eq(skill.userId, this.userId),
      orderBy: asc(skill.name),
    });
  }

  async getSkill(identifier: string): Promise<typeof skill.$inferSelect | null> {
    // Try by ID first
    let result = await this.db.query.skill.findFirst({
      where: eq(skill.id, identifier),
    });

    if (!result) {
      // Try by name
      result = await this.db.query.skill.findFirst({
        where: and(eq(skill.userId, this.userId), eq(skill.name, identifier)),
      });
    }

    return result ?? null;
  }

  async createSkill(
    payload: Omit<typeof skill.$inferInsert, 'userId' | 'id'>,
  ): Promise<typeof skill.$inferSelect> {
    const now = new Date();
    const [created] = await this.db
      .insert(skill)
      .values({
        ...payload,
        id: crypto.randomUUID(),
        userId: this.userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return created!;
  }

  async updateSkill(
    skillId: string,
    data: Partial<Omit<typeof skill.$inferInsert, 'userId' | 'id'>>,
  ): Promise<typeof skill.$inferSelect | null> {
    const [updated] = await this.db
      .update(skill)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(skill.id, skillId), eq(skill.userId, this.userId)))
      .returning();
    return updated ?? null;
  }

  async deleteSkill(skillId: string): Promise<boolean> {
    const result = await this.db
      .delete(skill)
      .where(and(eq(skill.id, skillId), eq(skill.userId, this.userId)))
      .returning({ id: skill.id });
    return result.length > 0;
  }

  async listSkillReferences(skillId: string): Promise<(typeof skillReference.$inferSelect)[]> {
    const skillRecord = await this.getSkill(skillId);
    if (!skillRecord) return [];

    return await this.db.query.skillReference.findMany({
      where: eq(skillReference.skillId, skillId),
      orderBy: asc(skillReference.order),
    });
  }

  async getSkillReference(
    skillId: string,
    referenceName: string,
  ): Promise<typeof skillReference.$inferSelect | null> {
    const skillRecord = await this.getSkill(skillId);
    if (!skillRecord) return null;

    const result = await this.db.query.skillReference.findFirst({
      where: and(
        eq(skillReference.skillId, skillId),
        eq(skillReference.name, referenceName),
      ),
    });
    return result ?? null;
  }

  async createSkillReference(
    skillId: string,
    payload: { name: string; content: string; order?: number },
  ): Promise<typeof skillReference.$inferSelect> {
    const skillRecord = await this.getSkill(skillId);
    if (!skillRecord) {
      throw new Error('Skill not found or access denied');
    }

    const now = new Date();
    const [created] = await this.db
      .insert(skillReference)
      .values({
        id: crypto.randomUUID(),
        skillId,
        name: payload.name,
        content: payload.content,
        order: payload.order ?? 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return created!;
  }

  async updateSkillReference(
    referenceId: string,
    data: Partial<{ name: string; content: string; order: number }>,
  ): Promise<typeof skillReference.$inferSelect | null> {
    const existing = await this.db.query.skillReference.findFirst({
      where: eq(skillReference.id, referenceId),
    });
    if (!existing) return null;

    const skillRecord = await this.getSkill(existing.skillId);
    if (!skillRecord) return null;

    const [updated] = await this.db
      .update(skillReference)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(skillReference.id, referenceId))
      .returning();
    return updated ?? null;
  }

  async deleteSkillReference(referenceId: string): Promise<boolean> {
    const existing = await this.db.query.skillReference.findFirst({
      where: eq(skillReference.id, referenceId),
    });
    if (!existing) return false;

    const skillRecord = await this.getSkill(existing.skillId);
    if (!skillRecord) return false;

    const result = await this.db
      .delete(skillReference)
      .where(eq(skillReference.id, referenceId))
      .returning({ id: skillReference.id });
    return result.length > 0;
  }

  // Workflows
  async listAllWorkflows(): Promise<(typeof workflow.$inferSelect)[]> {
    return await this.db.query.workflow.findMany({
      where: eq(workflow.userId, this.userId),
      orderBy: asc(workflow.name),
    });
  }

  async getWorkflow(identifier: string): Promise<typeof workflow.$inferSelect | null> {
    // Try by ID first
    let result = await this.db.query.workflow.findFirst({
      where: eq(workflow.id, identifier),
    });

    if (!result) {
      // Try by name
      result = await this.db.query.workflow.findFirst({
        where: and(eq(workflow.userId, this.userId), eq(workflow.name, identifier)),
      });
    }

    // Verify ownership
    if (result && result.userId !== this.userId) {
      return null;
    }

    return result ?? null;
  }

  async createWorkflow(payload: {
    name: string;
    description: string | null;
    connectionId: string | null;
    nodes: WorkflowNode[];
    connections: WorkflowConnections;
    settings: WorkflowSettings | null;
    isEnabled: boolean;
  }): Promise<typeof workflow.$inferSelect> {
    const now = new Date();
    const [created] = await this.db
      .insert(workflow)
      .values({
        ...payload,
        id: crypto.randomUUID(),
        userId: this.userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return created!;
  }

  async updateWorkflow(
    workflowId: string,
    data: Partial<{
      name: string;
      description: string;
      connectionId: string;
      nodes: WorkflowNode[];
      connections: WorkflowConnections;
      settings: WorkflowSettings;
      isEnabled: boolean;
    }>,
  ): Promise<typeof workflow.$inferSelect | null> {
    const [updated] = await this.db
      .update(workflow)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(workflow.id, workflowId), eq(workflow.userId, this.userId)))
      .returning();
    return updated ?? null;
  }

  async deleteWorkflow(workflowId: string): Promise<boolean> {
    const result = await this.db
      .delete(workflow)
      .where(and(eq(workflow.id, workflowId), eq(workflow.userId, this.userId)))
      .returning({ id: workflow.id });
    return result.length > 0;
  }

  // Workflow Executions
  async listWorkflowExecutions(
    workflowId: string,
    limit: number,
    _cursor?: string,
  ): Promise<(typeof workflowExecution.$inferSelect)[]> {
    const wf = await this.getWorkflow(workflowId);
    if (!wf) return [];

    const conditions = [eq(workflowExecution.workflowId, workflowId)];

    // Note: cursor pagination can be enhanced if needed
    return await this.db.query.workflowExecution.findMany({
      where: and(...conditions),
      orderBy: desc(workflowExecution.startedAt),
      limit,
    });
  }

  async getWorkflowExecution(
    executionId: string,
  ): Promise<typeof workflowExecution.$inferSelect | null> {
    const execution = await this.db.query.workflowExecution.findFirst({
      where: eq(workflowExecution.id, executionId),
    });

    if (!execution) return null;

    // Verify the workflow belongs to this user
    const wf = await this.getWorkflow(execution.workflowId);
    if (!wf) return null;

    return execution;
  }

  async createWorkflowExecution(payload: {
    workflowId: string;
    threadId: string | null;
    status: ExecutionStatus;
    triggerData: TriggerData | null;
    nodeResults: NodeExecutionResult[] | null;
    error: string | null;
  }): Promise<typeof workflowExecution.$inferSelect> {
    // Verify the workflow belongs to this user
    const wf = await this.getWorkflow(payload.workflowId);
    if (!wf) {
      throw new Error('Workflow not found or access denied');
    }

    const now = new Date();
    const [created] = await this.db
      .insert(workflowExecution)
      .values({
        ...payload,
        id: crypto.randomUUID(),
        startedAt: now,
      })
      .returning();
    return created!;
  }

  async updateWorkflowExecution(
    executionId: string,
    data: Partial<{
      status: ExecutionStatus;
      nodeResults: NodeExecutionResult[];
      error: string;
      completedAt: Date;
    }>,
  ): Promise<typeof workflowExecution.$inferSelect | null> {
    const existing = await this.getWorkflowExecution(executionId);
    if (!existing) return null;

    const [updated] = await this.db
      .update(workflowExecution)
      .set(data)
      .where(eq(workflowExecution.id, executionId))
      .returning();
    return updated ?? null;
  }
}

/**
 * Factory function to create a StandaloneDbRpc instance
 */
export function createStandaloneDbRpc(db: DB, userId: string): StandaloneDbRpc {
  return new StandaloneDbRpc(db, userId);
}
