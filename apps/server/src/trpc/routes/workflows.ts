import { getZeroDB, getThread } from '../../lib/server-utils';
import { privateProcedure, activeDriverProcedure, router } from '../trpc';
import { z } from 'zod';
import {
  WorkflowNodeSchema,
  WorkflowConnectionsSchema,
  WorkflowSettingsSchema,
} from '../../lib/workflow-engine/types';
import { testWorkflow, type NodeExecutionResult } from '../../lib/workflow-engine/executor';
import type { TriggerContext, ThreadData } from '../../lib/workflow-engine/triggers';
import { env } from '../../env';

const workflowsProcedure = privateProcedure.use(async ({ ctx, next }) => {
  const db = await getZeroDB(ctx.sessionUser.id);
  return next({ ctx: { ...ctx, db } });
});

export const workflowsRouter = router({
  // List all workflows for the user
  list: workflowsProcedure.query(async ({ ctx }) => {
    const workflows = await ctx.db.listAllWorkflows();
    return { workflows };
  }),

  // Get a single workflow by ID
  get: workflowsProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const workflow = await ctx.db.getWorkflow(input.id);
      return { workflow };
    }),

  // Create a new workflow
  create: workflowsProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        connectionId: z.string().optional(),
        nodes: z.array(WorkflowNodeSchema).optional(),
        connections: WorkflowConnectionsSchema.optional(),
        settings: WorkflowSettingsSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workflow = await ctx.db.createWorkflow({
        name: input.name,
        description: input.description ?? null,
        connectionId: input.connectionId ?? null,
        nodes: input.nodes ?? [],
        connections: input.connections ?? {},
        settings: input.settings ?? null,
        isEnabled: true,
      });
      return { workflow };
    }),

  // Update an existing workflow
  update: workflowsProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        connectionId: z.string().optional(),
        nodes: z.array(WorkflowNodeSchema).optional(),
        connections: WorkflowConnectionsSchema.optional(),
        settings: WorkflowSettingsSchema.optional(),
        isEnabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const workflow = await ctx.db.updateWorkflow(id, updates);
      return { workflow };
    }),

  // Delete a workflow
  delete: workflowsProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const success = await ctx.db.deleteWorkflow(input.id);
      return { success };
    }),

  // Toggle workflow enabled/disabled
  toggle: workflowsProcedure
    .input(z.object({ id: z.string(), isEnabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const workflow = await ctx.db.updateWorkflow(input.id, {
        isEnabled: input.isEnabled,
      });
      return { workflow };
    }),

  // Execute a workflow manually (for testing)
  execute: workflowsProcedure
    .input(
      z.object({
        id: z.string(),
        threadId: z.string().optional(),
        dryRun: z.boolean().optional().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Create execution record
      const execution = await ctx.db.createWorkflowExecution({
        workflowId: input.id,
        threadId: input.threadId ?? null,
        status: 'pending',
        triggerData: input.threadId ? { threadId: input.threadId } : null,
        nodeResults: null,
        error: null,
      });

      // TODO: In Phase 3, this will queue the workflow for actual execution
      // For now, just return the execution record
      return { execution, dryRun: input.dryRun };
    }),

  // List execution history for a workflow
  executions: workflowsProcedure
    .input(
      z.object({
        workflowId: z.string(),
        limit: z.number().min(1).max(100).optional().default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const executions = await ctx.db.listWorkflowExecutions(
        input.workflowId,
        input.limit,
        input.cursor,
      );
      return { executions };
    }),

  // Get a single execution by ID
  getExecution: workflowsProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const execution = await ctx.db.getWorkflowExecution(input.id);
      return { execution };
    }),

  // Test a workflow with a sample email (dry-run mode)
  test: activeDriverProcedure
    .input(
      z.object({
        workflowId: z.string().optional(),
        threadId: z.string(),
        nodes: z.array(WorkflowNodeSchema),
        connections: WorkflowConnectionsSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { activeConnection, sessionUser } = ctx;

      // Fetch thread data to build trigger context
      const threadResult = await getThread(activeConnection.id, input.threadId);
      const thread = threadResult.result;

      if (!thread || !thread.latest) {
        return {
          success: false,
          nodeResults: {} as Record<string, NodeExecutionResult>,
          executionPath: [] as string[],
          error: 'Thread not found',
        };
      }

      // Build ThreadData from the thread response
      const threadData: ThreadData = {
        id: input.threadId,
        subject: thread.latest.subject || '',
        sender: {
          name: thread.latest.sender?.name,
          email: thread.latest.sender?.email || '',
        },
        labels: thread.labels || [],
        receivedOn: thread.latest.receivedOn || new Date().toISOString(),
        unread: thread.hasUnread,
        body: thread.latest.body || thread.latest.decodedBody || '',
      };

      // Build trigger context
      const triggerContext: TriggerContext = {
        event: 'email_received',
        thread: threadData,
      };

      // Create action context with stub methods (since we're in dry-run mode)
      const actionContext = {
        connectionId: activeConnection.id,
        triggerData: {
          threadId: input.threadId,
          subject: threadData.subject,
          sender: threadData.sender.email,
          labels: threadData.labels.map((l) => l.id),
          snippet: threadData.body,
          receivedAt: threadData.receivedOn,
        },
        dryRun: true,
        // Stub methods - not called in dry-run mode
        modifyThread: async () => {},
        getLabels: async () => [],
      };

      // Execute workflow in test mode
      const result = await testWorkflow({
        nodes: input.nodes,
        connections: input.connections,
        triggerContext,
        userId: sessionUser.id,
        env,
        actionContext,
      });

      return result;
    }),
});
