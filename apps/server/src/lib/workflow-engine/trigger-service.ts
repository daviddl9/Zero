import { eq, and } from 'drizzle-orm';
import { workflow, workflowExecution } from '../../db/schema';
import { TriggerEvaluator, type TriggerContext } from './triggers';
import type { WorkflowDefinition, WorkflowNode } from './types';

/**
 * Thread data from sync operation
 */
export interface SyncedThreadData {
  id: string;
  subject: string;
  sender: {
    name?: string;
    email: string;
  };
  labels: Array<{ id: string; name: string }>;
  receivedOn: string;
  unread: boolean;
  body: string;
}

/**
 * Result of evaluating and triggering workflows
 */
export interface TriggerResult {
  triggeredWorkflows: Array<{
    workflowId: string;
    workflowName: string;
    executionId: string;
    matchedTriggerId: string;
  }>;
  errors: Array<{
    workflowId: string;
    error: string;
  }>;
}

/**
 * Database interface (subset used by this service)
 */
interface WorkflowDb {
  query: {
    workflow: {
      findMany: (opts: any) => Promise<any[]>;
    };
  };
  insert: (table: any) => {
    values: (data: any) => {
      returning: () => Promise<any[]>;
    };
  };
}

/**
 * Service for evaluating workflow triggers and creating execution records
 */
export class WorkflowTriggerService {
  private db: WorkflowDb;
  private triggerEvaluator: TriggerEvaluator;

  constructor(db: WorkflowDb) {
    this.db = db;
    this.triggerEvaluator = new TriggerEvaluator();
  }

  /**
   * Get all enabled workflows for a user/connection
   */
  async getEnabledWorkflows(
    userId: string,
    connectionId?: string
  ): Promise<WorkflowDefinition[]> {
    const conditions: any[] = [
      eq(workflow.userId, userId),
      eq(workflow.isEnabled, true),
    ];

    // If connectionId provided, filter by it or null (user-wide workflows)
    if (connectionId) {
      // For now, get all user workflows - connection filtering can be added later
    }

    const workflows = await this.db.query.workflow.findMany({
      where: and(...conditions),
    });

    return workflows.map((w: any) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      nodes: w.nodes || [],
      connections: w.connections || {},
      settings: w.settings,
    }));
  }

  /**
   * Evaluate triggers for all enabled workflows and create execution records
   */
  async evaluateAndTrigger(
    userId: string,
    connectionId: string,
    threadData: SyncedThreadData,
    event: TriggerContext['event'],
    labelChange?: { label: string; action: 'added' | 'removed' }
  ): Promise<TriggerResult> {
    const result: TriggerResult = {
      triggeredWorkflows: [],
      errors: [],
    };

    // Get all enabled workflows
    const workflows = await this.getEnabledWorkflows(userId, connectionId);

    if (workflows.length === 0) {
      return result;
    }

    // Build trigger context
    const triggerContext = TriggerEvaluator.buildTriggerContext(
      event,
      threadData,
      labelChange
    );

    // Evaluate each workflow
    for (const wf of workflows) {
      try {
        const triggers = this.extractTriggerNodes(wf);
        const evalResult = this.triggerEvaluator.evaluateWorkflow(triggers, triggerContext);

        if (evalResult.triggered && evalResult.matchedTriggerId) {
          // Create execution record
          const executionId = await this.createExecutionRecord(
            wf.id!,
            threadData.id,
            triggerContext
          );

          result.triggeredWorkflows.push({
            workflowId: wf.id!,
            workflowName: wf.name,
            executionId,
            matchedTriggerId: evalResult.matchedTriggerId,
          });
        }
      } catch (error) {
        result.errors.push({
          workflowId: wf.id!,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  /**
   * Create a workflow execution record with pending status
   */
  async createExecutionRecord(
    workflowId: string,
    threadId: string,
    triggerContext: TriggerContext
  ): Promise<string> {
    const id = crypto.randomUUID();

    const [execution] = await this.db
      .insert(workflowExecution)
      .values({
        id,
        workflowId,
        threadId,
        status: 'pending',
        triggerData: triggerContext,
        startedAt: new Date(),
      })
      .returning();

    return execution.id;
  }

  /**
   * Extract trigger nodes from a workflow definition
   */
  extractTriggerNodes(wf: WorkflowDefinition): WorkflowNode[] {
    return wf.nodes.filter((node) => node.type === 'trigger');
  }
}
