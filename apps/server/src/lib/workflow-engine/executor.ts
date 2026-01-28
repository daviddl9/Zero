import { eq } from 'drizzle-orm';
import { workflow, workflowExecution } from '../../db/schema';
import { ConditionEvaluator } from './conditions';
import { ActionExecutor, type ActionContext as ActionExecutorContext, type ActionResult } from './actions';
import type { WorkflowDefinition, WorkflowNode, WorkflowConnections, TriggerData, ConditionResult } from './types';
import type { TriggerContext } from './triggers';
import type { ZeroEnv } from '../../env';

/**
 * Result of executing a single node
 */
export interface NodeExecutionResult {
  executed: boolean;
  passed: boolean;
  error?: string;
  result?: ActionResult;
  outputIndex?: number; // Which output port was selected (for multi-output nodes)
  category?: string; // Matched category (for AI classification)
}

/**
 * Result of executing a workflow
 */
export interface ExecutionResult {
  success: boolean;
  status: 'pending' | 'running' | 'completed' | 'failed';
  skipped?: boolean;
  nodeResults?: Record<string, NodeExecutionResult>;
  error?: string;
}

/**
 * Dependencies for the workflow executor
 * Designed to work in both Cloudflare Workers and self-hosted (Raspberry Pi) environments
 */
export interface ExecutorDependencies {
  db: {
    query: {
      workflow: {
        findFirst: (opts: any) => Promise<any>;
      };
      workflowExecution: {
        findFirst: (opts: any) => Promise<any>;
      };
    };
    update: (table: any) => {
      set: (data: any) => {
        where: (condition: any) => Promise<any>;
      };
    };
  };
  actionContext: ActionContext;
  userId: string;
  env: ZeroEnv;
}

/**
 * Executes workflow graphs
 * Works in both Cloudflare Workers and self-hosted environments
 */
export class WorkflowExecutor {
  private db: ExecutorDependencies['db'];
  private actionContext: ActionContext;
  private conditionEvaluator: ConditionEvaluator;
  private actionExecutor: ActionExecutor;
  private userId: string;
  private env: ZeroEnv;

  constructor(deps: ExecutorDependencies) {
    this.db = deps.db;
    this.actionContext = deps.actionContext;
    this.userId = deps.userId;
    this.env = deps.env;
    this.conditionEvaluator = new ConditionEvaluator();
    this.actionExecutor = new ActionExecutor();
  }

  /**
   * Execute a workflow by execution ID
   */
  async execute(executionId: string): Promise<ExecutionResult> {
    // Fetch execution record
    const execution = await this.db.query.workflowExecution.findFirst({
      where: eq(workflowExecution.id, executionId),
    });

    if (!execution) {
      return {
        success: false,
        status: 'failed',
        error: `Execution ${executionId} not found`,
      };
    }

    // Skip if already processed
    if (execution.status === 'completed' || execution.status === 'failed') {
      return {
        success: true,
        status: execution.status,
        skipped: true,
      };
    }

    // Fetch workflow definition
    const wf = await this.db.query.workflow.findFirst({
      where: eq(workflow.id, execution.workflowId),
    });

    if (!wf) {
      await this.updateExecutionStatus(executionId, 'failed', undefined, `Workflow ${execution.workflowId} not found`);
      return {
        success: false,
        status: 'failed',
        error: `Workflow ${execution.workflowId} not found`,
      };
    }

    // Mark as running
    await this.updateExecutionStatus(executionId, 'running');

    try {
      // Build workflow definition
      const workflowDef: WorkflowDefinition = {
        id: wf.id,
        name: wf.name,
        description: wf.description,
        nodes: wf.nodes || [],
        connections: wf.connections || {},
        settings: wf.settings,
      };

      // Find the trigger that was matched
      const triggerData = execution.triggerData as TriggerContext;
      const trigger = workflowDef.nodes.find((n) => n.type === 'trigger');
      const triggerId = trigger?.id;

      if (!triggerId) {
        await this.updateExecutionStatus(executionId, 'failed', undefined, 'No trigger found in workflow');
        return {
          success: false,
          status: 'failed',
          error: 'No trigger found in workflow',
        };
      }

      // Execute workflow using branch-following execution
      const nodeResults: Record<string, NodeExecutionResult> = {};
      const nodeMap = new Map(workflowDef.nodes.map((n) => [n.id, n]));

      // Execute starting from trigger, following branches based on condition results
      await this.executeFromNode(
        triggerId,
        nodeMap,
        workflowDef.connections,
        triggerData,
        nodeResults,
      );

      // Mark as completed
      await this.updateExecutionStatus(executionId, 'completed', nodeResults);

      return {
        success: true,
        status: 'completed',
        nodeResults,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.updateExecutionStatus(executionId, 'failed', undefined, errorMessage);

      return {
        success: false,
        status: 'failed',
        error: errorMessage,
      };
    }
  }

  /**
   * Execute a single node
   */
  async executeNode(node: WorkflowNode, triggerData: TriggerContext): Promise<NodeExecutionResult> {
    // Skip disabled nodes
    if (node.disabled) {
      return { executed: false, passed: true };
    }

    switch (node.type) {
      case 'trigger':
        // Triggers just pass through
        return { executed: true, passed: true };

      case 'condition':
        return this.executeCondition(node, triggerData);

      case 'action':
        return this.executeAction(node, triggerData);

      default:
        return { executed: false, passed: false, error: `Unknown node type: ${node.type}` };
    }
  }

  /**
   * Execute a condition node (async to support AI classification)
   */
  private async executeCondition(
    node: WorkflowNode,
    triggerData: TriggerContext,
  ): Promise<NodeExecutionResult> {
    try {
      // Convert TriggerContext to TriggerData format expected by ConditionEvaluator
      const conditionTriggerData: TriggerData = {
        threadId: triggerData.thread.id,
        subject: triggerData.thread.subject,
        sender: triggerData.thread.sender.email,
        labels: triggerData.thread.labels.map((l) => l.id),
        snippet: triggerData.thread.body,
        receivedAt: triggerData.thread.receivedOn,
      };

      // Get the condition type from nodeType
      const conditionType = node.nodeType as string;

      // Use async evaluation to support AI classification
      const result: ConditionResult = await this.conditionEvaluator.evaluateAsync(
        conditionType,
        conditionTriggerData,
        node.parameters,
        this.userId,
        this.env,
      );

      return {
        executed: true,
        passed: result.passed,
        outputIndex: result.outputIndex,
        category: result.category,
      };
    } catch (error) {
      return {
        executed: true,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute an action node
   */
  private async executeAction(node: WorkflowNode, triggerData: TriggerContext): Promise<NodeExecutionResult> {
    try {
      // Convert TriggerContext to TriggerData format expected by ActionExecutor
      const actionTriggerData: TriggerData = {
        threadId: triggerData.thread.id,
        subject: triggerData.thread.subject,
        sender: triggerData.thread.sender.email,
        labels: triggerData.thread.labels.map((l) => l.id),
        snippet: triggerData.thread.body,
        receivedAt: triggerData.thread.receivedOn,
      };

      // Build the action context with triggerData
      const ctx: ActionExecutorContext = {
        ...this.actionContext,
        triggerData: actionTriggerData,
      };

      const actionType = node.nodeType as string;
      const result = await this.actionExecutor.execute(actionType, ctx, node.parameters);

      return {
        executed: true,
        passed: result.success,
        result,
        error: result.error,
      };
    } catch (error) {
      return {
        executed: true,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute workflow starting from a node, following branches based on condition results
   */
  private async executeFromNode(
    nodeId: string,
    nodeMap: Map<string, WorkflowNode>,
    connections: WorkflowConnections,
    triggerData: TriggerContext,
    nodeResults: Record<string, NodeExecutionResult>,
    visited: Set<string> = new Set(),
  ): Promise<void> {
    // Prevent infinite loops
    if (visited.has(nodeId)) {
      return;
    }
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) {
      return;
    }

    // Execute this node
    const result = await this.executeNode(node, triggerData);
    nodeResults[node.id] = result;

    // If execution failed and it's not a routing node, stop this branch
    if (!result.passed && node.type !== 'condition') {
      return;
    }

    // Get next nodes based on output index
    const outputIndex = result.outputIndex ?? 0;
    const nextNodes = this.getNodesForOutput(nodeId, outputIndex, connections, nodeMap);

    // For non-routing conditions that failed, don't continue
    if (node.type === 'condition' && !result.passed && result.outputIndex === undefined) {
      return;
    }

    // Execute next nodes (in parallel if multiple nodes on same output)
    await Promise.all(
      nextNodes.map((nextNode) =>
        this.executeFromNode(
          nextNode.id,
          nodeMap,
          connections,
          triggerData,
          nodeResults,
          visited,
        ),
      ),
    );
  }

  /**
   * Get nodes connected to a specific output index
   */
  private getNodesForOutput(
    nodeId: string,
    outputIndex: number,
    connections: WorkflowConnections,
    nodeMap: Map<string, WorkflowNode>,
  ): WorkflowNode[] {
    const nodeConnections = connections[nodeId];
    if (!nodeConnections?.main?.[outputIndex]) {
      return []; // No nodes connected to this output
    }

    return nodeConnections.main[outputIndex]
      .map((conn) => nodeMap.get(conn.node))
      .filter((n): n is WorkflowNode => n !== undefined);
  }

  /**
   * Get nodes in execution order (BFS from trigger)
   * @deprecated Use executeFromNode for branch-following execution
   */
  getExecutionOrder(wf: WorkflowDefinition, triggerId: string): WorkflowNode[] {
    const nodeMap = new Map(wf.nodes.map((n) => [n.id, n]));
    const visited = new Set<string>();
    const order: WorkflowNode[] = [];
    const queue: string[] = [triggerId];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;

      if (visited.has(nodeId)) {
        continue;
      }

      visited.add(nodeId);

      const node = nodeMap.get(nodeId);
      if (node) {
        order.push(node);
      }

      // Add connected nodes to queue
      const connections = wf.connections[nodeId];
      if (connections?.main) {
        for (const outputs of connections.main) {
          for (const target of outputs) {
            if (!visited.has(target.node)) {
              queue.push(target.node);
            }
          }
        }
      }
    }

    return order;
  }

  /**
   * Update execution status in database
   */
  async updateExecutionStatus(
    executionId: string,
    status: 'pending' | 'running' | 'completed' | 'failed',
    nodeResults?: Record<string, NodeExecutionResult>,
    error?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date();
    }

    if (nodeResults) {
      updateData.nodeResults = nodeResults;
    }

    if (error) {
      updateData.error = error;
    }

    await this.db
      .update(workflowExecution)
      .set(updateData)
      .where(eq(workflowExecution.id, executionId));
  }
}

/**
 * Factory function to create executor with dependencies
 * Works in both Cloudflare Workers and self-hosted environments
 */
export function createWorkflowExecutor(
  db: ExecutorDependencies['db'],
  actionContext: ActionContext,
  userId: string,
  env: ZeroEnv,
): WorkflowExecutor {
  return new WorkflowExecutor({ db, actionContext, userId, env });
}
