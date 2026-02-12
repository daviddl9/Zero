import type {
  WorkflowNode,
  WorkflowConnections,
  WorkflowDefinitionNode,
  TriggerData,
  NodeExecutionResult,



} from './types';

// Node type mapping from n8n-style types to internal types
const NODE_TYPE_MAP: Record<string, { category: 'trigger' | 'condition' | 'action'; type: string }> = {
  // Triggers
  'zero:emailReceived': { category: 'trigger', type: 'email_received' },
  'zero:emailLabeled': { category: 'trigger', type: 'email_labeled' },
  'zero:schedule': { category: 'trigger', type: 'schedule' },

  // Conditions
  'zero:senderMatch': { category: 'condition', type: 'sender_match' },
  'zero:subjectMatch': { category: 'condition', type: 'subject_match' },
  'zero:labelMatch': { category: 'condition', type: 'label_match' },
  'zero:aiClassification': { category: 'condition', type: 'ai_classification' },
  'zero:keywordMatch': { category: 'condition', type: 'keyword_match' },

  // Actions
  'zero:markRead': { category: 'action', type: 'mark_read' },
  'zero:markUnread': { category: 'action', type: 'mark_unread' },
  'zero:addLabel': { category: 'action', type: 'add_label' },
  'zero:removeLabel': { category: 'action', type: 'remove_label' },
  'zero:archive': { category: 'action', type: 'archive' },
  'zero:generateDraft': { category: 'action', type: 'generate_draft' },
  'zero:sendNotification': { category: 'action', type: 'send_notification' },
  'zero:runSkill': { category: 'action', type: 'run_skill' },
};

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ExecutionContext {
  triggerData: TriggerData;
  nodeResults: Map<string, NodeExecutionResult>;
  envVars?: Record<string, string>;
  dryRun?: boolean;
}

export class WorkflowEngine {
  /**
   * Parse n8n-style node type to internal category and type
   */
  parseNodeType(nodeType: string): { category: string; type: string } {
    const mapping = NODE_TYPE_MAP[nodeType];
    if (mapping) {
      return mapping;
    }
    return { category: 'unknown', type: nodeType };
  }

  /**
   * Get execution order using topological sort
   * Returns node IDs in the order they should be executed
   */
  getExecutionOrder(
    nodes: WorkflowDefinitionNode[],
    connections: WorkflowConnections,
  ): string[] {
    // Filter out disabled nodes
    const activeNodes = nodes.filter((n) => !n.disabled);
    const nodeIds = new Set(activeNodes.map((n) => n.id));

    // Build adjacency list
    const adjacency: Map<string, string[]> = new Map();
    const inDegree: Map<string, number> = new Map();

    for (const node of activeNodes) {
      adjacency.set(node.id, []);
      inDegree.set(node.id, 0);
    }

    // Populate adjacency list and in-degrees from connections
    for (const [sourceId, conn] of Object.entries(connections)) {
      if (!nodeIds.has(sourceId)) continue;

      for (const outputs of conn.main) {
        for (const target of outputs) {
          if (!nodeIds.has(target.node)) continue;

          adjacency.get(sourceId)!.push(target.node);
          inDegree.set(target.node, (inDegree.get(target.node) || 0) + 1);
        }
      }
    }

    // Kahn's algorithm for topological sort
    const queue: string[] = [];
    const result: string[] = [];

    // Find nodes with no incoming edges (triggers)
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      for (const neighbor of adjacency.get(current) || []) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }

  /**
   * Interpolate variables in a message string
   * Supports {{$trigger.fieldName}} and {{$env.VAR_NAME}} syntax
   */
  interpolateMessage(
    message: string,
    triggerData: TriggerData,
    envVars?: Record<string, string>,
  ): string {
    return message.replace(/\{\{\$(\w+)\.(\w+)\}\}/g, (match, source, field) => {
      if (source === 'trigger') {
        const value = (triggerData as Record<string, unknown>)[field];
        return value !== undefined ? String(value) : '';
      }
      if (source === 'env' && envVars) {
        return envVars[field] || '';
      }
      return '';
    });
  }

  /**
   * Validate a workflow definition
   */
  validateWorkflow(
    nodes: WorkflowDefinitionNode[],
    connections: WorkflowConnections,
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for at least one trigger
    const triggers = nodes.filter((n) => {
      const parsed = this.parseNodeType(n.type);
      return parsed.category === 'trigger';
    });

    if (triggers.length === 0) {
      errors.push('Workflow must have at least one trigger node');
    }

    // Build set of all node IDs
    const nodeIds = new Set(nodes.map((n) => n.id));

    // Check for invalid connection targets
    for (const [sourceId, conn] of Object.entries(connections)) {
      if (!nodeIds.has(sourceId)) {
        warnings.push(`Connection source '${sourceId}' does not exist`);
        continue;
      }

      for (const outputs of conn.main) {
        for (const target of outputs) {
          if (!nodeIds.has(target.node)) {
            errors.push(`Connection target '${target.node}' does not exist`);
          }
        }
      }
    }

    // Check for orphaned/unreachable nodes
    const reachable = new Set<string>();

    // Start from triggers
    const queue = triggers.map((t) => t.id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (reachable.has(current)) continue;
      reachable.add(current);

      const conn = connections[current];
      if (conn) {
        for (const outputs of conn.main) {
          for (const target of outputs) {
            if (!reachable.has(target.node)) {
              queue.push(target.node);
            }
          }
        }
      }
    }

    // Find orphaned nodes (excluding disabled ones)
    const activeNodes = nodes.filter((n) => !n.disabled);
    for (const node of activeNodes) {
      const parsed = this.parseNodeType(node.type);
      // Triggers are starting points, so they're not orphaned
      if (parsed.category !== 'trigger' && !reachable.has(node.id)) {
        errors.push(`Node '${node.id}' is orphaned/unreachable`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Convert n8n-style definition nodes to internal WorkflowNode format
   */
  convertDefinitionToInternal(definitionNodes: WorkflowDefinitionNode[]): WorkflowNode[] {
    return definitionNodes.map((defNode) => {
      const parsed = this.parseNodeType(defNode.type);

      return {
        id: defNode.id,
        type: parsed.category as 'trigger' | 'condition' | 'action',
        name: defNode.name || defNode.id,
        position: defNode.position,
        parameters: defNode.parameters,
        disabled: defNode.disabled,
      };
    });
  }

  /**
   * Check if a node is a trigger type
   */
  isTriggerNode(nodeType: string): boolean {
    const parsed = this.parseNodeType(nodeType);
    return parsed.category === 'trigger';
  }

  /**
   * Check if a node is a condition type
   */
  isConditionNode(nodeType: string): boolean {
    const parsed = this.parseNodeType(nodeType);
    return parsed.category === 'condition';
  }

  /**
   * Check if a node is an action type
   */
  isActionNode(nodeType: string): boolean {
    const parsed = this.parseNodeType(nodeType);
    return parsed.category === 'action';
  }

  /**
   * Get all nodes downstream of a given node
   */
  getDownstreamNodes(
    nodeId: string,
    connections: WorkflowConnections,
    allNodeIds: Set<string>,
  ): string[] {
    const downstream: string[] = [];
    const visited = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const conn = connections[current];
      if (conn) {
        for (const outputs of conn.main) {
          for (const target of outputs) {
            if (allNodeIds.has(target.node) && !visited.has(target.node)) {
              downstream.push(target.node);
              queue.push(target.node);
            }
          }
        }
      }
    }

    return downstream;
  }
}
