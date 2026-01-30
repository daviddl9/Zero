import { eq } from 'drizzle-orm';
import { workflow, workflowExecution } from '../../db/schema';
import { ConditionEvaluator } from './conditions';
import { ActionExecutor, type ActionContext, type ActionContext as ActionExecutorContext, type ActionResult } from './actions';
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

/**
 * Result of a test workflow execution
 */
export interface TestWorkflowResult {
  success: boolean;
  nodeResults: Record<string, NodeExecutionResult>;
  executionPath: string[];
  error?: string;
}

/**
 * Options for test workflow execution
 */
export interface TestWorkflowOptions {
  nodes: WorkflowNode[];
  connections: WorkflowConnections;
  triggerContext: TriggerContext;
  userId: string;
  env: ZeroEnv;
  actionContext: ActionContext;
}

/**
 * Execute a workflow in test/dry-run mode without DB persistence
 * Returns per-node results and execution path for visualization
 */
export async function testWorkflow(options: TestWorkflowOptions): Promise<TestWorkflowResult> {
  const { nodes, connections, triggerContext, userId, env, actionContext } = options;

  // Create condition and action evaluators
  const conditionEvaluator = new ConditionEvaluator();
  const actionExecutor = new ActionExecutor();

  // Build node map for quick lookup
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Track execution results and path
  const nodeResults: Record<string, NodeExecutionResult> = {};
  const executionPath: string[] = [];

  // Find the trigger node
  const trigger = nodes.find((n) => n.type === 'trigger');
  if (!trigger) {
    return {
      success: false,
      nodeResults: {},
      executionPath: [],
      error: 'No trigger found in workflow',
    };
  }

  try {
    // Execute workflow starting from trigger using branch-following
    await executeTestFromNode(
      trigger.id,
      nodeMap,
      connections,
      triggerContext,
      nodeResults,
      executionPath,
      conditionEvaluator,
      actionExecutor,
      { ...actionContext, dryRun: true },
      userId,
      env,
      new Set(),
    );

    return {
      success: true,
      nodeResults,
      executionPath,
    };
  } catch (error) {
    return {
      success: false,
      nodeResults,
      executionPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute workflow starting from a node, following branches (test mode)
 */
async function executeTestFromNode(
  nodeId: string,
  nodeMap: Map<string, WorkflowNode>,
  connections: WorkflowConnections,
  triggerData: TriggerContext,
  nodeResults: Record<string, NodeExecutionResult>,
  executionPath: string[],
  conditionEvaluator: ConditionEvaluator,
  actionExecutor: ActionExecutor,
  actionContext: ActionContext,
  userId: string,
  env: ZeroEnv,
  visited: Set<string>,
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

  // Track execution path
  executionPath.push(nodeId);

  // Execute this node
  const result = await executeTestNode(
    node,
    triggerData,
    conditionEvaluator,
    actionExecutor,
    actionContext,
    userId,
    env,
  );
  nodeResults[node.id] = result;

  // If execution failed and it's not a routing node, stop this branch
  if (!result.passed && node.type !== 'condition') {
    return;
  }

  // Get next nodes based on output index
  const outputIndex = result.outputIndex ?? 0;
  const nextNodes = getTestNodesForOutput(nodeId, outputIndex, connections, nodeMap);

  // For non-routing conditions that failed, don't continue
  if (node.type === 'condition' && !result.passed && result.outputIndex === undefined) {
    return;
  }

  // Execute next nodes
  await Promise.all(
    nextNodes.map((nextNode) =>
      executeTestFromNode(
        nextNode.id,
        nodeMap,
        connections,
        triggerData,
        nodeResults,
        executionPath,
        conditionEvaluator,
        actionExecutor,
        actionContext,
        userId,
        env,
        visited,
      ),
    ),
  );
}

/**
 * Execute a single node in test mode
 */
async function executeTestNode(
  node: WorkflowNode,
  triggerData: TriggerContext,
  conditionEvaluator: ConditionEvaluator,
  actionExecutor: ActionExecutor,
  actionContext: ActionContext,
  userId: string,
  env: ZeroEnv,
): Promise<NodeExecutionResult> {
  // Skip disabled nodes
  if (node.disabled) {
    return { executed: false, passed: true };
  }

  switch (node.type) {
    case 'trigger':
      return { executed: true, passed: true };

    case 'condition':
      return executeTestCondition(node, triggerData, conditionEvaluator, userId, env);

    case 'action':
      return executeTestAction(node, triggerData, actionExecutor, actionContext);

    default:
      return { executed: false, passed: false, error: `Unknown node type: ${node.type}` };
  }
}

/**
 * Convert TriggerContext to TriggerData format
 */
function toTriggerData(triggerContext: TriggerContext): TriggerData {
  return {
    threadId: triggerContext.thread.id,
    subject: triggerContext.thread.subject,
    sender: triggerContext.thread.sender.email,
    labels: triggerContext.thread.labels.map((l) => l.id),
    snippet: triggerContext.thread.body,
    receivedAt: triggerContext.thread.receivedOn,
  };
}

/**
 * Execute a condition node in test mode
 */
async function executeTestCondition(
  node: WorkflowNode,
  triggerContext: TriggerContext,
  conditionEvaluator: ConditionEvaluator,
  userId: string,
  env: ZeroEnv,
): Promise<NodeExecutionResult> {
  try {
    const result: ConditionResult = await conditionEvaluator.evaluateAsync(
      node.nodeType,
      toTriggerData(triggerContext),
      node.parameters,
      userId,
      env,
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
 * Execute an action node in test mode (always dry run)
 */
async function executeTestAction(
  node: WorkflowNode,
  triggerContext: TriggerContext,
  actionExecutor: ActionExecutor,
  actionContext: ActionContext,
): Promise<NodeExecutionResult> {
  try {
    const ctx: ActionExecutorContext = {
      ...actionContext,
      triggerData: toTriggerData(triggerContext),
      dryRun: true,
    };

    const result = await actionExecutor.execute(node.nodeType, ctx, node.parameters);

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
 * Get nodes connected to a specific output index (test mode helper)
 */
function getTestNodesForOutput(
  nodeId: string,
  outputIndex: number,
  connections: WorkflowConnections,
  nodeMap: Map<string, WorkflowNode>,
): WorkflowNode[] {
  const nodeConnections = connections[nodeId];
  if (!nodeConnections?.main?.[outputIndex]) {
    return [];
  }

  return nodeConnections.main[outputIndex]
    .map((conn) => nodeMap.get(conn.node))
    .filter((n): n is WorkflowNode => n !== undefined);
}
