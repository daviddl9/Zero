import {
  createUpdatedMatrixFromNewEmail,
  initializeStyleMatrixFromEmail,
  type EmailMatrix,
  type WritingStyleMatrix,
} from './services/writing-style-service';
import {
  account,
  connection,
  note,
  session,
  user,
  userHotkeys,
  userSettings,
  writingStyleMatrix,
  emailTemplate,
  skill,
  skillReference,
  workflow,
  workflowExecution,
} from './db/schema';
import type {
  WorkflowNode,
  WorkflowConnections,
  WorkflowSettings,
  ExecutionStatus,
  TriggerData,
  NodeExecutionResult,
} from './lib/workflow-engine/types';
import {
  toAttachmentFiles,
  type SerializedAttachment,
  type AttachmentFile,
} from './lib/attachments';
import { SyncThreadsCoordinatorWorkflow } from './workflows/sync-threads-coordinator-workflow';
import { WorkerEntrypoint, DurableObject, RpcTarget } from 'cloudflare:workers';
// import { instrument, type ResolveConfigFn } from '@microlabs/otel-cf-workers';
import { getZeroAgent, getZeroDB, verifyToken } from './lib/server-utils';
import { SyncThreadsWorkflow } from './workflows/sync-threads-workflow';
import { ShardRegistry, ZeroAgent, ZeroDriver } from './routes/agent';
import { ThreadSyncWorker } from './routes/agent/sync-worker';
import { oAuthDiscoveryMetadata } from 'better-auth/plugins';
import { EProviders, type IEmailSendBatch } from './types';
import { eq, and, desc, asc, inArray, lt } from 'drizzle-orm';
import { ThinkingMCP } from './lib/sequential-thinking';

import { contextStorage } from 'hono/context-storage';
import { defaultUserSettings } from './lib/schemas';
import { createLocalJWKSet, jwtVerify } from 'jose';
import { trpcServer } from '@hono/trpc-server';
import { agentsMiddleware } from 'hono-agents';
import { ZeroMCP } from './routes/agent/mcp';
import { publicRouter } from './routes/auth';
import { WorkflowRunner } from './pipelines';
import { autumnApi } from './routes/autumn';
import { initTracing } from './lib/tracing';
import { env, type ZeroEnv } from './env';
import type { HonoContext } from './ctx';
import { createDb, type DB } from './db';
import { createAuth } from './lib/auth';
import { aiRouter } from './routes/ai';
import { appRouter } from './trpc';
import { cors } from 'hono/cors';
import { Hono } from 'hono';

const SENTRY_HOST = 'o4509328786915328.ingest.us.sentry.io';
const SENTRY_PROJECT_IDS = new Set(['4509328795303936']);

export class DbRpcDO extends RpcTarget {
  constructor(
    private mainDo: ZeroDB,
    private userId: string,
  ) {
    super();
  }

  async findUser(): Promise<typeof user.$inferSelect | undefined> {
    return await this.mainDo.findUser(this.userId);
  }

  async findUserConnection(
    connectionId: string,
  ): Promise<typeof connection.$inferSelect | undefined> {
    return await this.mainDo.findUserConnection(this.userId, connectionId);
  }

  async updateUser(data: Partial<typeof user.$inferInsert>) {
    return await this.mainDo.updateUser(this.userId, data);
  }

  async deleteConnection(connectionId: string) {
    return await this.mainDo.deleteConnection(connectionId, this.userId);
  }

  async findFirstConnection(): Promise<typeof connection.$inferSelect | undefined> {
    return await this.mainDo.findFirstConnection(this.userId);
  }

  async findManyConnections(): Promise<(typeof connection.$inferSelect)[]> {
    return await this.mainDo.findManyConnections(this.userId);
  }

  async findManyNotesByThreadId(threadId: string): Promise<(typeof note.$inferSelect)[]> {
    return await this.mainDo.findManyNotesByThreadId(this.userId, threadId);
  }

  async createNote(payload: Omit<typeof note.$inferInsert, 'userId'>) {
    return await this.mainDo.createNote(this.userId, payload as typeof note.$inferInsert);
  }

  async updateNote(noteId: string, payload: Partial<typeof note.$inferInsert>) {
    return await this.mainDo.updateNote(this.userId, noteId, payload);
  }

  async updateManyNotes(
    notes: { id: string; order: number; isPinned?: boolean | null }[],
  ): Promise<boolean> {
    return await this.mainDo.updateManyNotes(this.userId, notes);
  }

  async findManyNotesByIds(noteIds: string[]): Promise<(typeof note.$inferSelect)[]> {
    return await this.mainDo.findManyNotesByIds(this.userId, noteIds);
  }

  async deleteNote(noteId: string) {
    return await this.mainDo.deleteNote(this.userId, noteId);
  }

  async findNoteById(noteId: string): Promise<typeof note.$inferSelect | undefined> {
    return await this.mainDo.findNoteById(this.userId, noteId);
  }

  async findHighestNoteOrder(): Promise<{ order: number } | undefined> {
    return await this.mainDo.findHighestNoteOrder(this.userId);
  }

  async deleteUser() {
    return await this.mainDo.deleteUser(this.userId);
  }

  async findUserSettings(): Promise<typeof userSettings.$inferSelect | undefined> {
    return await this.mainDo.findUserSettings(this.userId);
  }

  async findUserHotkeys(): Promise<(typeof userHotkeys.$inferSelect)[]> {
    return await this.mainDo.findUserHotkeys(this.userId);
  }

  async insertUserHotkeys(shortcuts: (typeof userHotkeys.$inferInsert)[]) {
    return await this.mainDo.insertUserHotkeys(this.userId, shortcuts);
  }

  async insertUserSettings(settings: typeof defaultUserSettings) {
    return await this.mainDo.insertUserSettings(this.userId, settings);
  }

  async updateUserSettings(settings: typeof defaultUserSettings) {
    return await this.mainDo.updateUserSettings(this.userId, settings);
  }

  async updateEncryptedApiKey(provider: 'openai' | 'gemini', encryptedKey: string | null) {
    return await this.mainDo.updateEncryptedApiKey(this.userId, provider, encryptedKey);
  }

  async createConnection(
    providerId: EProviders,
    email: string,
    updatingInfo: {
      expiresAt: Date;
      scope: string;
    },
  ): Promise<{ id: string }[]> {
    return await this.mainDo.createConnection(providerId, email, this.userId, updatingInfo);
  }

  async findConnectionById(
    connectionId: string,
  ): Promise<typeof connection.$inferSelect | undefined> {
    return await this.mainDo.findConnectionById(connectionId);
  }

  async syncUserMatrix(connectionId: string, emailStyleMatrix: EmailMatrix) {
    return await this.mainDo.syncUserMatrix(connectionId, emailStyleMatrix);
  }

  async findWritingStyleMatrix(
    connectionId: string,
  ): Promise<typeof writingStyleMatrix.$inferSelect | undefined> {
    return await this.mainDo.findWritingStyleMatrix(connectionId);
  }

  async deleteActiveConnection(connectionId: string) {
    return await this.mainDo.deleteActiveConnection(this.userId, connectionId);
  }

  async updateConnection(
    connectionId: string,
    updatingInfo: Partial<typeof connection.$inferInsert>,
  ) {
    return await this.mainDo.updateConnection(connectionId, updatingInfo);
  }

  async listEmailTemplates(): Promise<(typeof emailTemplate.$inferSelect)[]> {
    return await this.mainDo.findManyEmailTemplates(this.userId);
  }

  async createEmailTemplate(payload: Omit<typeof emailTemplate.$inferInsert, 'userId'>) {
    return await this.mainDo.createEmailTemplate(this.userId, payload);
  }

  async deleteEmailTemplate(templateId: string) {
    return await this.mainDo.deleteEmailTemplate(this.userId, templateId);
  }

  async updateEmailTemplate(templateId: string, data: Partial<typeof emailTemplate.$inferInsert>) {
    return await this.mainDo.updateEmailTemplate(this.userId, templateId, data);
  }

  async listAllSkills(): Promise<(typeof skill.$inferSelect)[]> {
    return await this.mainDo.findAllSkills(this.userId);
  }

  async getSkill(identifier: string): Promise<typeof skill.$inferSelect | null> {
    return await this.mainDo.findSkill(this.userId, identifier);
  }

  async createSkill(payload: Omit<typeof skill.$inferInsert, 'userId' | 'id'>): Promise<typeof skill.$inferSelect> {
    return await this.mainDo.createSkill(this.userId, payload);
  }

  async updateSkill(
    skillId: string,
    data: Partial<Omit<typeof skill.$inferInsert, 'userId' | 'id'>>,
  ): Promise<typeof skill.$inferSelect | null> {
    return await this.mainDo.updateSkill(this.userId, skillId, data);
  }

  async deleteSkill(skillId: string): Promise<boolean> {
    return await this.mainDo.deleteSkill(this.userId, skillId);
  }

  async listSkillReferences(skillId: string): Promise<(typeof skillReference.$inferSelect)[]> {
    return await this.mainDo.findSkillReferences(this.userId, skillId);
  }

  async getSkillReference(
    skillId: string,
    referenceName: string,
  ): Promise<typeof skillReference.$inferSelect | null> {
    return await this.mainDo.findSkillReference(this.userId, skillId, referenceName);
  }

  async createSkillReference(
    skillId: string,
    payload: { name: string; content: string; order?: number },
  ): Promise<typeof skillReference.$inferSelect> {
    return await this.mainDo.createSkillReference(this.userId, skillId, payload);
  }

  async updateSkillReference(
    referenceId: string,
    data: Partial<{ name: string; content: string; order: number }>,
  ): Promise<typeof skillReference.$inferSelect | null> {
    return await this.mainDo.updateSkillReference(this.userId, referenceId, data);
  }

  async deleteSkillReference(referenceId: string): Promise<boolean> {
    return await this.mainDo.deleteSkillReference(this.userId, referenceId);
  }

  // Workflow methods
  async listAllWorkflows(): Promise<(typeof workflow.$inferSelect)[]> {
    return await this.mainDo.findAllWorkflows(this.userId);
  }

  async getWorkflow(identifier: string): Promise<typeof workflow.$inferSelect | null> {
    return await this.mainDo.findWorkflow(this.userId, identifier);
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
    return await this.mainDo.createWorkflow(this.userId, payload);
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
    return await this.mainDo.updateWorkflow(this.userId, workflowId, data);
  }

  async deleteWorkflow(workflowId: string): Promise<boolean> {
    return await this.mainDo.deleteWorkflow(this.userId, workflowId);
  }

  // Workflow Execution methods
  async listWorkflowExecutions(
    workflowId: string,
    limit: number,
    cursor?: string,
  ): Promise<(typeof workflowExecution.$inferSelect)[]> {
    return await this.mainDo.findWorkflowExecutions(this.userId, workflowId, limit, cursor);
  }

  async getWorkflowExecution(
    executionId: string,
  ): Promise<typeof workflowExecution.$inferSelect | null> {
    return await this.mainDo.findWorkflowExecution(this.userId, executionId);
  }

  async createWorkflowExecution(payload: {
    workflowId: string;
    threadId: string | null;
    status: ExecutionStatus;
    triggerData: TriggerData | null;
    nodeResults: NodeExecutionResult[] | null;
    error: string | null;
  }): Promise<typeof workflowExecution.$inferSelect> {
    return await this.mainDo.createWorkflowExecution(this.userId, payload);
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
    return await this.mainDo.updateWorkflowExecution(this.userId, executionId, data);
  }
}

class ZeroDB extends DurableObject<ZeroEnv> {
  db: DB = createDb(this.env.HYPERDRIVE.connectionString).db;

  async setMetaData(userId: string) {
    return new DbRpcDO(this, userId);
  }

  async findUser(userId: string): Promise<typeof user.$inferSelect | undefined> {
    return await this.db.query.user.findFirst({
      where: eq(user.id, userId),
    });
  }

  async findUserConnection(
    userId: string,
    connectionId: string,
  ): Promise<typeof connection.$inferSelect | undefined> {
    return await this.db.query.connection.findFirst({
      where: and(eq(connection.userId, userId), eq(connection.id, connectionId)),
    });
  }

  async updateUser(userId: string, data: Partial<typeof user.$inferInsert>) {
    return await this.db.update(user).set(data).where(eq(user.id, userId));
  }

  async deleteConnection(connectionId: string, userId: string) {
    const connections = await this.findManyConnections(userId);
    if (connections.length <= 1) {
      throw new Error('Cannot delete the last connection. At least one connection is required.');
    }
    return await this.db
      .delete(connection)
      .where(and(eq(connection.id, connectionId), eq(connection.userId, userId)));
  }

  async findFirstConnection(userId: string): Promise<typeof connection.$inferSelect | undefined> {
    return await this.db.query.connection.findFirst({
      where: eq(connection.userId, userId),
    });
  }

  async findManyConnections(userId: string): Promise<(typeof connection.$inferSelect)[]> {
    return await this.db.query.connection.findMany({
      where: eq(connection.userId, userId),
    });
  }

  async findManyNotesByThreadId(
    userId: string,
    threadId: string,
  ): Promise<(typeof note.$inferSelect)[]> {
    return await this.db.query.note.findMany({
      where: and(eq(note.userId, userId), eq(note.threadId, threadId)),
      orderBy: [desc(note.isPinned), asc(note.order), desc(note.createdAt)],
    });
  }

  async createNote(userId: string, payload: typeof note.$inferInsert) {
    return await this.db
      .insert(note)
      .values({
        ...payload,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
  }

  async updateNote(
    userId: string,
    noteId: string,
    payload: Partial<typeof note.$inferInsert>,
  ): Promise<typeof note.$inferSelect | undefined> {
    const [updated] = await this.db
      .update(note)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(and(eq(note.id, noteId), eq(note.userId, userId)))
      .returning();
    return updated;
  }

  async updateManyNotes(
    userId: string,
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
          .where(and(eq(note.id, n.id), eq(note.userId, userId)));
      }
      return true;
    });
  }

  async findManyNotesByIds(
    userId: string,
    noteIds: string[],
  ): Promise<(typeof note.$inferSelect)[]> {
    return await this.db.query.note.findMany({
      where: and(eq(note.userId, userId), inArray(note.id, noteIds)),
    });
  }

  async deleteNote(userId: string, noteId: string) {
    return await this.db.delete(note).where(and(eq(note.id, noteId), eq(note.userId, userId)));
  }

  async findNoteById(
    userId: string,
    noteId: string,
  ): Promise<typeof note.$inferSelect | undefined> {
    return await this.db.query.note.findFirst({
      where: and(eq(note.id, noteId), eq(note.userId, userId)),
    });
  }

  async findHighestNoteOrder(userId: string): Promise<{ order: number } | undefined> {
    return await this.db.query.note.findFirst({
      where: eq(note.userId, userId),
      orderBy: desc(note.order),
      columns: { order: true },
    });
  }

  async deleteUser(userId: string) {
    return await this.db.transaction(async (tx) => {
      await tx.delete(connection).where(eq(connection.userId, userId));
      await tx.delete(account).where(eq(account.userId, userId));
      await tx.delete(session).where(eq(session.userId, userId));
      await tx.delete(userSettings).where(eq(userSettings.userId, userId));
      await tx.delete(user).where(eq(user.id, userId));
      await tx.delete(userHotkeys).where(eq(userHotkeys.userId, userId));
    });
  }

  async findUserSettings(userId: string): Promise<typeof userSettings.$inferSelect | undefined> {
    return await this.db.query.userSettings.findFirst({
      where: eq(userSettings.userId, userId),
    });
  }

  async findUserHotkeys(userId: string): Promise<(typeof userHotkeys.$inferSelect)[]> {
    return await this.db.query.userHotkeys.findMany({
      where: eq(userHotkeys.userId, userId),
    });
  }

  async insertUserHotkeys(userId: string, shortcuts: (typeof userHotkeys.$inferInsert)[]) {
    return await this.db
      .insert(userHotkeys)
      .values({
        userId,
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

  async insertUserSettings(userId: string, settings: typeof defaultUserSettings) {
    return await this.db.insert(userSettings).values({
      id: crypto.randomUUID(),
      userId,
      settings,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async updateUserSettings(userId: string, settings: typeof defaultUserSettings) {
    return await this.db
      .insert(userSettings)
      .values({
        id: crypto.randomUUID(),
        userId,
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

  async updateEncryptedApiKey(
    userId: string,
    provider: 'openai' | 'gemini',
    encryptedKey: string | null,
  ) {
    const column =
      provider === 'openai' ? userSettings.encryptedOpenaiKey : userSettings.encryptedGeminiKey;

    return await this.db
      .update(userSettings)
      .set({
        [column.name]: encryptedKey,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, userId));
  }

  async createConnection(
    providerId: EProviders,
    email: string,
    userId: string,
    updatingInfo: {
      expiresAt: Date;
      scope: string;
    },
  ): Promise<{ id: string }[]> {
    return await this.db
      .insert(connection)
      .values({
        ...updatingInfo,
        providerId,
        id: crypto.randomUUID(),
        email,
        userId,
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

  /**
   * @param connectionId Dangerous, use findUserConnection instead
   * @returns
   */
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

  async deleteActiveConnection(userId: string, connectionId: string) {
    return await this.db
      .delete(connection)
      .where(and(eq(connection.userId, userId), eq(connection.id, connectionId)));
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

  async findManyEmailTemplates(userId: string): Promise<(typeof emailTemplate.$inferSelect)[]> {
    return await this.db.query.emailTemplate.findMany({
      where: eq(emailTemplate.userId, userId),
      orderBy: desc(emailTemplate.updatedAt),
    });
  }

  async createEmailTemplate(
    userId: string,
    payload: Omit<typeof emailTemplate.$inferInsert, 'userId'>,
  ) {
    return await this.db
      .insert(emailTemplate)
      .values({
        ...payload,
        userId,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
  }

  async deleteEmailTemplate(userId: string, templateId: string) {
    return await this.db
      .delete(emailTemplate)
      .where(and(eq(emailTemplate.id, templateId), eq(emailTemplate.userId, userId)));
  }

  async updateEmailTemplate(
    userId: string,
    templateId: string,
    data: Partial<typeof emailTemplate.$inferInsert>,
  ) {
    return await this.db
      .update(emailTemplate)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(emailTemplate.id, templateId), eq(emailTemplate.userId, userId)))
      .returning();
  }

  async findAllSkills(userId: string): Promise<(typeof skill.$inferSelect)[]> {
    return await this.db.query.skill.findMany({
      where: eq(skill.userId, userId),
      orderBy: asc(skill.name),
    });
  }

  async findSkill(userId: string, identifier: string): Promise<typeof skill.$inferSelect | null> {
    // Try by ID first
    let result = await this.db.query.skill.findFirst({
      where: eq(skill.id, identifier),
    });

    if (!result) {
      // Try by name
      result = await this.db.query.skill.findFirst({
        where: and(eq(skill.userId, userId), eq(skill.name, identifier)),
      });
    }

    return result ?? null;
  }

  async createSkill(
    userId: string,
    payload: Omit<typeof skill.$inferInsert, 'userId' | 'id'>,
  ): Promise<typeof skill.$inferSelect> {
    const now = new Date();
    const [created] = await this.db
      .insert(skill)
      .values({
        ...payload,
        id: crypto.randomUUID(),
        userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return created!;
  }

  async updateSkill(
    userId: string,
    skillId: string,
    data: Partial<Omit<typeof skill.$inferInsert, 'userId' | 'id'>>,
  ): Promise<typeof skill.$inferSelect | null> {
    const [updated] = await this.db
      .update(skill)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(skill.id, skillId), eq(skill.userId, userId)))
      .returning();
    return updated ?? null;
  }

  async deleteSkill(userId: string, skillId: string): Promise<boolean> {
    const result = await this.db
      .delete(skill)
      .where(and(eq(skill.id, skillId), eq(skill.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async findSkillReferences(
    userId: string,
    skillId: string,
  ): Promise<(typeof skillReference.$inferSelect)[]> {
    // First verify the skill belongs to this user
    const skillRecord = await this.findSkill(userId, skillId);
    if (!skillRecord) return [];

    return await this.db.query.skillReference.findMany({
      where: eq(skillReference.skillId, skillId),
      orderBy: asc(skillReference.order),
    });
  }

  async findSkillReference(
    userId: string,
    skillId: string,
    referenceName: string,
  ): Promise<typeof skillReference.$inferSelect | null> {
    // First verify the skill belongs to this user
    const skillRecord = await this.findSkill(userId, skillId);
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
    userId: string,
    skillId: string,
    payload: { name: string; content: string; order?: number },
  ): Promise<typeof skillReference.$inferSelect> {
    // First verify the skill belongs to this user
    const skillRecord = await this.findSkill(userId, skillId);
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
    userId: string,
    referenceId: string,
    data: Partial<{ name: string; content: string; order: number }>,
  ): Promise<typeof skillReference.$inferSelect | null> {
    // First get the reference to verify ownership
    const existing = await this.db.query.skillReference.findFirst({
      where: eq(skillReference.id, referenceId),
    });
    if (!existing) return null;

    // Verify the skill belongs to this user
    const skillRecord = await this.findSkill(userId, existing.skillId);
    if (!skillRecord) return null;

    const [updated] = await this.db
      .update(skillReference)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(skillReference.id, referenceId))
      .returning();
    return updated ?? null;
  }

  async deleteSkillReference(userId: string, referenceId: string): Promise<boolean> {
    // First get the reference to verify ownership
    const existing = await this.db.query.skillReference.findFirst({
      where: eq(skillReference.id, referenceId),
    });
    if (!existing) return false;

    // Verify the skill belongs to this user
    const skillRecord = await this.findSkill(userId, existing.skillId);
    if (!skillRecord) return false;

    const result = await this.db
      .delete(skillReference)
      .where(eq(skillReference.id, referenceId));
    return (result.rowCount ?? 0) > 0;
  }

  // =========================================================================
  // Workflow Methods
  // =========================================================================

  async findAllWorkflows(userId: string): Promise<(typeof workflow.$inferSelect)[]> {
    return await this.db.query.workflow.findMany({
      where: eq(workflow.userId, userId),
      orderBy: asc(workflow.name),
    });
  }

  async findWorkflow(
    userId: string,
    identifier: string,
  ): Promise<typeof workflow.$inferSelect | null> {
    // Try by ID first
    let result = await this.db.query.workflow.findFirst({
      where: eq(workflow.id, identifier),
    });

    if (!result) {
      // Try by name
      result = await this.db.query.workflow.findFirst({
        where: and(eq(workflow.userId, userId), eq(workflow.name, identifier)),
      });
    }

    // Verify ownership
    if (result && result.userId !== userId) {
      return null;
    }

    return result ?? null;
  }

  async createWorkflow(
    userId: string,
    payload: {
      name: string;
      description: string | null;
      connectionId: string | null;
      nodes: WorkflowNode[];
      connections: WorkflowConnections;
      settings: WorkflowSettings | null;
      isEnabled: boolean;
    },
  ): Promise<typeof workflow.$inferSelect> {
    const now = new Date();
    const [created] = await this.db
      .insert(workflow)
      .values({
        ...payload,
        id: crypto.randomUUID(),
        userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return created!;
  }

  async updateWorkflow(
    userId: string,
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
      .where(and(eq(workflow.id, workflowId), eq(workflow.userId, userId)))
      .returning();
    return updated ?? null;
  }

  async deleteWorkflow(userId: string, workflowId: string): Promise<boolean> {
    const result = await this.db
      .delete(workflow)
      .where(and(eq(workflow.id, workflowId), eq(workflow.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  // =========================================================================
  // Workflow Execution Methods
  // =========================================================================

  async findWorkflowExecutions(
    userId: string,
    workflowId: string,
    limit: number,
    cursor?: string,
  ): Promise<(typeof workflowExecution.$inferSelect)[]> {
    // First verify the workflow belongs to this user
    const wf = await this.findWorkflow(userId, workflowId);
    if (!wf) return [];

    const conditions = [eq(workflowExecution.workflowId, workflowId)];

    if (cursor) {
      // Cursor is the ID of the last execution, fetch older ones
      const cursorExec = await this.db.query.workflowExecution.findFirst({
        where: eq(workflowExecution.id, cursor),
      });
      if (cursorExec) {
        conditions.push(
          // Get executions started before the cursor
          // Using raw SQL comparison for timestamp
        );
      }
    }

    return await this.db.query.workflowExecution.findMany({
      where: and(...conditions),
      orderBy: desc(workflowExecution.startedAt),
      limit,
    });
  }

  async findWorkflowExecution(
    userId: string,
    executionId: string,
  ): Promise<typeof workflowExecution.$inferSelect | null> {
    const execution = await this.db.query.workflowExecution.findFirst({
      where: eq(workflowExecution.id, executionId),
    });

    if (!execution) return null;

    // Verify the workflow belongs to this user
    const wf = await this.findWorkflow(userId, execution.workflowId);
    if (!wf) return null;

    return execution;
  }

  async createWorkflowExecution(
    userId: string,
    payload: {
      workflowId: string;
      threadId: string | null;
      status: ExecutionStatus;
      triggerData: TriggerData | null;
      nodeResults: NodeExecutionResult[] | null;
      error: string | null;
    },
  ): Promise<typeof workflowExecution.$inferSelect> {
    // Verify the workflow belongs to this user
    const wf = await this.findWorkflow(userId, payload.workflowId);
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
    userId: string,
    executionId: string,
    data: Partial<{
      status: ExecutionStatus;
      nodeResults: NodeExecutionResult[];
      error: string;
      completedAt: Date;
    }>,
  ): Promise<typeof workflowExecution.$inferSelect | null> {
    // First verify the execution exists and user owns the workflow
    const existing = await this.findWorkflowExecution(userId, executionId);
    if (!existing) return null;

    const [updated] = await this.db
      .update(workflowExecution)
      .set(data)
      .where(eq(workflowExecution.id, executionId))
      .returning();
    return updated ?? null;
  }
}

// Utility function to hash IP addresses for PII protection
function hashIpAddress(ip: string | undefined): string | undefined {
  if (!ip) return undefined;

  // Simple but effective hash for IP addresses
  // This preserves uniqueness while protecting PII
  const salt = 'zero-mail-ip-salt-2024'; // Consider using env variable for production
  let hash = 0;
  const str = ip + salt;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Return a prefixed hex representation
  return `ip_${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

const api = new Hono<HonoContext>()
  .use(contextStorage())
  .use('*', async (c, next) => {
    // Initialize request tracing using headers (no context pollution)
    const traceId = c.req.header('X-Trace-ID') || crypto.randomUUID();
    const requestId = c.req.header('X-Request-Id') || crypto.randomUUID();

    // Set trace ID in response headers for client correlation
    c.header('X-Trace-ID', traceId);
    c.header('X-Request-ID', requestId);

    // Store trace ID in context variables for TRPC access
    c.set('traceId', traceId);
    c.set('requestId', requestId);

    const { TraceContext } = await import('./lib/trace-context');

    // Create trace for this request
    const rawIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');
    const trace = TraceContext.createTrace(traceId, {
      requestId,
      ip: hashIpAddress(rawIp), // Hash IP address to protect PII
      userAgent: c.req.header('User-Agent'),
    });

    // Start authentication span
    const authSpan = TraceContext.startSpan(
      traceId,
      'authentication',
      {
        method: c.req.method,
        url: c.req.url,
        hasAuthHeader: !!c.req.header('Authorization'),
      },
      {
        'auth.method': c.req.header('Authorization') ? 'bearer_token' : 'session_cookie',
      },
    );

    const auth = createAuth();
    c.set('auth', auth);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    c.set('sessionUser', session?.user);

    if (c.req.header('Authorization') && !session?.user) {
      // Start token verification span
      const tokenSpan = TraceContext.startSpan(
        traceId,
        'token_verification',
        {
          tokenPresent: true,
        },
        {
          'auth.token_type': 'jwt',
        },
      );

      const token = c.req.header('Authorization')?.split(' ')[1];

      if (token) {
        try {
          const localJwks = await auth.api.getJwks();
          const jwks = createLocalJWKSet(localJwks);

          const { payload } = await jwtVerify(token, jwks);
          const userId = payload.sub;

          if (userId) {
            const db = await getZeroDB(userId);
            const user = await db.findUser();
            c.set('sessionUser', user);

            TraceContext.completeSpan(traceId, tokenSpan.id, {
              success: true,
              userId,
            });
          } else {
            TraceContext.completeSpan(traceId, tokenSpan.id, {
              success: false,
              reason: 'no_user_id_in_token',
            });
          }
        } catch (error) {
          TraceContext.completeSpan(
            traceId,
            tokenSpan.id,
            {
              success: false,
              reason: 'token_verification_failed',
            },
            error instanceof Error ? error.message : 'Unknown token error',
          );
        }
      } else {
        TraceContext.completeSpan(traceId, tokenSpan.id, {
          success: false,
          reason: 'no_token_provided',
        });
      }
    }

    // Complete auth span
    TraceContext.completeSpan(traceId, authSpan.id, {
      authenticated: !!c.var.sessionUser,
      userId: c.var.sessionUser?.id,
      authMethod: session?.user ? 'session' : c.req.header('Authorization') ? 'token' : 'none',
    });

    // Update trace metadata with user info
    trace.metadata.userId = c.var.sessionUser?.id;
    trace.metadata.sessionId = c.var.sessionUser?.id || 'anonymous';

    // Start request processing span
    const requestSpan = TraceContext.startSpan(traceId, 'request_processing', {
      authenticated: !!c.var.sessionUser,
      path: new URL(c.req.url).pathname,
    });

    try {
      await next();
      // Don't complete the request span here - let TRPC middleware handle it
    } catch (error) {
      TraceContext.completeSpan(
        traceId,
        requestSpan.id,
        {
          success: false,

          statusCode: c.res.status,
        },
        error instanceof Error ? error.message : 'Unknown request error',
      );
      throw error;
    }
    // Note: Trace will be completed by TRPC middleware after logging

    c.set('sessionUser', undefined);
    c.set('auth', undefined as any);
  })
  .route('/ai', aiRouter)
  .route('/autumn', autumnApi)
  .route('/public', publicRouter)
  .on(['GET', 'POST', 'OPTIONS'], '/auth/*', (c) => {
    return c.var.auth.handler(c.req.raw);
  })
  .post('/monitoring/sentry', async (c) => {
    try {
      const envelopeBytes = await c.req.arrayBuffer();
      const envelope = new TextDecoder().decode(envelopeBytes);
      const piece = envelope.split('\n')[0];
      const header = JSON.parse(piece);
      const dsn = new URL(header['dsn']);
      const project_id = dsn.pathname?.replace('/', '');

      if (dsn.hostname !== SENTRY_HOST) {
        throw new Error(`Invalid sentry hostname: ${dsn.hostname}`);
      }

      if (!project_id || !SENTRY_PROJECT_IDS.has(project_id)) {
        throw new Error(`Invalid sentry project id: ${project_id}`);
      }

      const upstream_sentry_url = `https://${SENTRY_HOST}/api/${project_id}/envelope/`;
      await fetch(upstream_sentry_url, {
        method: 'POST',
        body: envelopeBytes,
      });

      return c.json({}, { status: 200 });
    } catch (e) {
      console.error('error tunneling to sentry', e);
      return c.json({ error: 'error tunneling to sentry' }, { status: 500 });
    }
  })
  .post('/a8n/notify/:providerId', async (c) => {
    const tracer = initTracing();
    const span = tracer.startSpan('a8n_notify', {
      attributes: {
        'provider.id': c.req.param('providerId'),
        'notification.type': 'email_notification',
        'http.method': c.req.method,
        'http.url': c.req.url,
      },
    });

    try {
      if (!c.req.header('Authorization')) {
        span.setAttributes({ 'auth.status': 'missing' });
        return c.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (env.DISABLE_WORKFLOWS === 'true') {
        span.setAttributes({ 'workflows.disabled': true });
        return c.json({ message: 'OK' }, { status: 200 });
      }
      const providerId = c.req.param('providerId');
      if (providerId === EProviders.google) {
        const body = await c.req.json<{ historyId: string }>();
        const subHeader = c.req.header('x-goog-pubsub-subscription-name');

        span.setAttributes({
          'history.id': body.historyId,
          'subscription.name': subHeader || 'missing',
        });

        if (!subHeader) {
          console.log('[GOOGLE] no subscription header', body);
          span.setAttributes({ 'error.type': 'missing_subscription_header' });
          return c.json({}, { status: 200 });
        }
        const isValid = await verifyToken(c.req.header('Authorization')!.split(' ')[1]);
        if (!isValid) {
          console.log('[GOOGLE] invalid request', body);
          span.setAttributes({ 'auth.status': 'invalid' });
          return c.json({}, { status: 200 });
        }

        span.setAttributes({ 'auth.status': 'valid' });

        try {
          await env.thread_queue.send({
            providerId,
            historyId: body.historyId,
            subscriptionName: subHeader,
          });
          span.setAttributes({ 'queue.message_sent': true });
        } catch (error) {
          console.error('Error sending to thread queue', error, {
            providerId,
            historyId: body.historyId,
            subscriptionName: subHeader,
          });
          span.recordException(error as Error);
          span.setStatus({ code: 2, message: (error as Error).message });
        }
        return c.json({ message: 'OK' }, { status: 200 });
      }
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message });
      throw error;
    } finally {
      span.end();
    }
  })
  .get('/health', (c) => c.json({ message: 'Zero Server is Up!' }))
  .use(
    trpcServer({
      endpoint: '/api/trpc',
      router: appRouter,
      createContext: (_, c) => {
        return { c, sessionUser: c.var['sessionUser'], db: c.var['db'] };
      },
      allowMethodOverride: true,
      onError: (opts) => {
        console.error('Error in TRPC handler:', opts.error);
      },
    }),
  )
  .onError(async (err, c) => {
    if (err instanceof Response) return err;
    console.error('Error in Hono handler:', err);
    return c.json(
      {
        error: 'Internal Server Error',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      500,
    );
  });

const app = new Hono<HonoContext>()
  .use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin) return null;
        let hostname: string;
        try {
          hostname = new URL(origin).hostname;
        } catch {
          return null;
        }
        const cookieDomain = env.COOKIE_DOMAIN;
        if (!cookieDomain) return null;
        if (hostname === cookieDomain || hostname.endsWith('.' + cookieDomain)) {
          return origin;
        }
        return null;
      },
      credentials: true,
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['X-Zero-Redirect'],
    }),
  )
  .get('.well-known/oauth-authorization-server', async (c) => {
    const auth = createAuth();
    return oAuthDiscoveryMetadata(auth)(c.req.raw);
  })
  .mount(
    '/sse',
    async (request, env, ctx) => {
      const authBearer = request.headers.get('Authorization');
      if (!authBearer) {
        console.log('No auth provided');
        return new Response('Unauthorized', { status: 401 });
      }
      const auth = createAuth();
      const session = await auth.api.getMcpSession({ headers: request.headers });
      if (!session) {
        console.log('Invalid auth provided', Array.from(request.headers.entries()));
        return new Response('Unauthorized', { status: 401 });
      }
      ctx.props = {
        userId: session?.userId,
      };
      return ZeroMCP.serveSSE('/sse', { binding: 'ZERO_MCP' }).fetch(request, env, ctx);
    },
    { replaceRequest: false },
  )
  .mount(
    '/mcp/thinking/sse',
    async (request, env, ctx) => {
      return ThinkingMCP.serveSSE('/mcp/thinking/sse', { binding: 'THINKING_MCP' }).fetch(
        request,
        env,
        ctx,
      );
    },
    { replaceRequest: false },
  )
  .mount(
    '/mcp',
    async (request, env, ctx) => {
      const authBearer = request.headers.get('Authorization');
      if (!authBearer) {
        return new Response('Unauthorized', { status: 401 });
      }
      const auth = createAuth();
      const session = await auth.api.getMcpSession({ headers: request.headers });
      if (!session) {
        console.log('Invalid auth provided', Array.from(request.headers.entries()));
        return new Response('Unauthorized', { status: 401 });
      }
      ctx.props = {
        userId: session?.userId,
      };
      return ZeroMCP.serve('/mcp', { binding: 'ZERO_MCP' }).fetch(request, env, ctx);
    },
    { replaceRequest: false },
  )
  .route('/api', api)
  .use(
    '*',
    agentsMiddleware({
      options: {
        onBeforeConnect: (c) => {
          if (!c.headers.get('Cookie')) {
            return new Response('Unauthorized', { status: 401 });
          }
        },
      },
    }),
  )
  .get('/', (c) => c.redirect(`${env.VITE_PUBLIC_APP_URL}`))
  .post('/monitoring/sentry', async (c) => {
    // Legacy route support if needed at root, or just redirect
    return c.redirect('/api/monitoring/sentry', 307);
  });
const handler = {
  async fetch(request: Request, env: ZeroEnv, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },
};

// const config: ResolveConfigFn = (env: ZeroEnv) => {
//   return {
//     exporter: {
//       url: env.OTEL_EXPORTER_OTLP_ENDPOINT || 'https://api.axiom.co/v1/traces',
//       headers: env.OTEL_EXPORTER_OTLP_HEADERS
//         ? Object.fromEntries(
//             env.OTEL_EXPORTER_OTLP_HEADERS.split(',').map((header: string) => {
//               const [key, value] = header.split('=');
//               return [key.trim(), value.trim()];
//             }),
//           )
//         : {},
//     },
//     service: {
//       name: env.OTEL_SERVICE_NAME || 'zero-email-server',
//       version: '1.0.0',
//     },
//   };
// };

export default class Entry extends WorkerEntrypoint<ZeroEnv> {
  async fetch(request: Request): Promise<Response> {
    return handler.fetch(request, this.env, this.ctx);
  }
  async queue(
    batch: MessageBatch<unknown> | { queue: string; messages: Array<{ body: IEmailSendBatch }> },
  ) {
    switch (true) {
      case batch.queue.startsWith('subscribe-queue'): {
        // Subscribe queue handler - Brain function removed
        console.log('[SUBSCRIBE_QUEUE] batch received', batch.messages.length, 'messages');
        return;
      }
      case batch.queue.startsWith('send-email-queue'): {
        await Promise.all(
          batch.messages.map(async (msg: any) => {
            const { messageId, connectionId, mail } = msg.body;

            const { pending_emails_status: statusKV, pending_emails_payload: payloadKV } = this
              .env as { pending_emails_status: KVNamespace; pending_emails_payload: KVNamespace };

            const status = await statusKV.get(messageId);
            if (status === 'cancelled') {
              console.log(`Email ${messageId} cancelled – skipping send.`);
              return;
            }

            let payload = mail;
            if (!payload) {
              const stored = await payloadKV.get(messageId);
              if (!stored) {
                console.error(`No payload found for scheduled email ${messageId}`);
                return;
              }
              payload = JSON.parse(stored);
            }

            const agent = await getZeroAgent(connectionId, this.ctx);
            try {
              if (Array.isArray((payload as any).attachments)) {
                const attachments = (payload as any).attachments;

                const processedAttachments = await Promise.all(
                  attachments.map(
                    async (att: SerializedAttachment | AttachmentFile, index: number) => {
                      if ('arrayBuffer' in att && typeof att.arrayBuffer === 'function') {
                        return { attachment: att as AttachmentFile, index };
                      } else {
                        const processed = toAttachmentFiles([att as SerializedAttachment]);
                        return { attachment: processed[0], index };
                      }
                    },
                  ),
                );

                const orderedAttachments = Array.from({ length: attachments.length });
                processedAttachments.forEach(({ attachment, index }) => {
                  orderedAttachments[index] = attachment;
                });

                (payload as any).attachments = orderedAttachments;
              }

              if ('draftId' in (payload as any) && (payload as any).draftId) {
                const { draftId, ...rest } = payload as any;
                await agent.stub.sendDraft(draftId, rest as any);
              } else {
                await agent.stub.create(payload as any);
              }

              await statusKV.delete(messageId);
              await payloadKV.delete(messageId);
              console.log(`Email ${messageId} sent successfully`);
            } catch (error) {
              console.error(`Failed to send scheduled email ${messageId}:`, error);
              await statusKV.delete(messageId);
              await payloadKV.delete(messageId);
            }
          }),
        );
        return;
      }
      case batch.queue.startsWith('thread-queue'): {
        const tracer = initTracing();

        await Promise.all(
          batch.messages.map(async (msg: any) => {
            const span = tracer.startSpan('thread_queue_processing', {
              attributes: {
                'provider.id': msg.body.providerId,
                'history.id': msg.body.historyId,
                'subscription.name': msg.body.subscriptionName,
                'queue.name': batch.queue,
              },
            });

            try {
              const providerId = msg.body.providerId;
              const historyId = msg.body.historyId;
              const subscriptionName = msg.body.subscriptionName;

              const workflowRunner = env.WORKFLOW_RUNNER.get(env.WORKFLOW_RUNNER.newUniqueId());
              const result = await workflowRunner.runMainWorkflow({
                providerId,
                historyId,
                subscriptionName,
              });
              console.log('[THREAD_QUEUE] result', result);
              span.setAttributes({
                'workflow.result': typeof result === 'string' ? result : JSON.stringify(result),
                'workflow.success': true,
              });
            } catch (error) {
              console.error('Error running workflow', error);
              span.recordException(error as Error);
              span.setStatus({ code: 2, message: (error as Error).message });
            } finally {
              span.end();
            }
          }),
        );
        break;
      }
    }
  }
  async scheduled() {
    console.log('Running scheduled tasks...');

    await this.processScheduledEmails();

    await this.processExpiredSubscriptions();

    await this.cleanupOldWorkflowExecutions();
  }

  private async processScheduledEmails() {
    console.log('Checking for scheduled emails ready to be queued...');
    const { scheduled_emails: scheduledKV, send_email_queue } = this.env as {
      scheduled_emails: KVNamespace;
      send_email_queue: Queue<IEmailSendBatch>;
    };

    try {
      const now = Date.now();
      const twelveHoursFromNow = now + 12 * 60 * 60 * 1000;

      let cursor: string | undefined = undefined;
      const batchSize = 1000;

      do {
        const listResp: {
          keys: { name: string }[];
          cursor?: string;
        } = await scheduledKV.list({ cursor, limit: batchSize });
        cursor = listResp.cursor;

        for (const key of listResp.keys) {
          try {
            const scheduledData = await scheduledKV.get(key.name);
            if (!scheduledData) continue;

            const { messageId, connectionId, sendAt } = JSON.parse(scheduledData);

            if (sendAt <= twelveHoursFromNow) {
              const delaySeconds = Math.max(0, Math.floor((sendAt - now) / 1000));

              console.log(`Queueing scheduled email ${messageId} with ${delaySeconds}s delay`);

              const queueBody: IEmailSendBatch = {
                messageId,
                connectionId,
                sendAt,
              };

              await send_email_queue.send(queueBody, { delaySeconds });
              await scheduledKV.delete(key.name);

              console.log(`Successfully queued scheduled email ${messageId}`);
            }
          } catch (error) {
            console.error('Failed to process scheduled email key', key.name, error);
          }
        }
      } while (cursor);
    } catch (error) {
      console.error('Error processing scheduled emails:', error);
    }
  }

  private async processExpiredSubscriptions() {
    console.log('[SCHEDULED] Checking for expired subscriptions...');
    const { db, conn } = createDb(this.env.HYPERDRIVE.connectionString);
    const allAccounts = await db.query.connection.findMany({
      where: (fields, { isNotNull, and }) =>
        and(isNotNull(fields.accessToken), isNotNull(fields.refreshToken)),
    });
    await conn.end();
    console.log('[SCHEDULED] allAccounts', allAccounts.length);
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    const expiredSubscriptions: Array<{ connectionId: string; providerId: EProviders }> = [];

    const nowTs = Date.now();

    const unsnoozeMap: Record<string, { threadIds: string[]; keyNames: string[] }> = {};

    let cursor: string | undefined = undefined;
    do {
      const listResp: {
        keys: { name: string; metadata?: { wakeAt?: string } }[];
        cursor?: string;
      } = await this.env.snoozed_emails.list({ cursor, limit: 1000 });
      cursor = listResp.cursor;

      for (const key of listResp.keys) {
        try {
          const wakeAtIso = key.metadata?.wakeAt as string | undefined;
          if (!wakeAtIso) continue;
          const wakeAt = new Date(wakeAtIso).getTime();
          if (wakeAt > nowTs) continue;

          const [threadId, connectionId] = key.name.split('__');
          if (!threadId || !connectionId) continue;

          if (!unsnoozeMap[connectionId]) {
            unsnoozeMap[connectionId] = { threadIds: [], keyNames: [] };
          }
          unsnoozeMap[connectionId].threadIds.push(threadId);
          unsnoozeMap[connectionId].keyNames.push(key.name);
        } catch (error) {
          console.error('Failed to prepare unsnooze for key', key.name, error);
        }
      }
    } while (cursor);

    // await Promise.all(
    //   Object.entries(unsnoozeMap).map(async ([connectionId, { threadIds, keyNames }]) => {
    //     try {
    //       const { stub: agent } = await getZeroAgent(connectionId, this.ctx);
    //       await agent.queue('unsnoozeThreadsHandler', { connectionId, threadIds, keyNames });
    //     } catch (error) {
    //       console.error('Failed to enqueue unsnooze tasks', { connectionId, threadIds, error });
    //     }
    //   }),
    // );

    await Promise.all(
      allAccounts.map(async ({ id, providerId }) => {
        const lastSubscribed = await this.env.gmail_sub_age.get(`${id}__${providerId}`);

        if (lastSubscribed) {
          const subscriptionDate = new Date(lastSubscribed);
          if (subscriptionDate < fiveDaysAgo) {
            console.log(`[SCHEDULED] Found expired Google subscription for connection: ${id}`);
            expiredSubscriptions.push({ connectionId: id, providerId: providerId as EProviders });
          }
        } else {
          expiredSubscriptions.push({ connectionId: id, providerId: providerId as EProviders });
        }
      }),
    );

    // Send expired subscriptions to queue for renewal
    if (expiredSubscriptions.length > 0) {
      console.log(
        `[SCHEDULED] Sending ${expiredSubscriptions.length} expired subscriptions to renewal queue`,
      );
      await Promise.all(
        expiredSubscriptions.map(async ({ connectionId, providerId }) => {
          await this.env.subscribe_queue.send({ connectionId, providerId });
        }),
      );
    }

    console.log(
      `[SCHEDULED] Processed ${allAccounts.keys.length} accounts, found ${expiredSubscriptions.length} expired subscriptions`,
    );
  }

  private async cleanupOldWorkflowExecutions() {
    console.log('[SCHEDULED] Cleaning up old workflow executions...');

    const { db, conn } = createDb(this.env.HYPERDRIVE.connectionString);

    try {
      const retentionDays = 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await db
        .delete(workflowExecution)
        .where(lt(workflowExecution.startedAt, cutoffDate));

      const deletedCount = result.rowCount ?? 0;
      console.log(
        `[SCHEDULED] Deleted ${deletedCount} workflow executions older than ${retentionDays} days`,
      );
    } catch (error) {
      console.error('[SCHEDULED] Error cleaning up workflow executions:', error);
    } finally {
      await conn.end();
    }
  }
}

export {
  ZeroAgent,
  ZeroMCP,
  ZeroDB,
  ZeroDriver,
  ThinkingMCP,
  WorkflowRunner,
  ThreadSyncWorker,
  SyncThreadsWorkflow,
  SyncThreadsCoordinatorWorkflow,
  ShardRegistry,
};
