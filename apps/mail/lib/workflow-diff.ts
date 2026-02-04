import type { Node, Edge } from '@xyflow/react';
import type { WorkflowNodeData } from '@/components/workflows/workflow-node';

// ============================================================================
// Type Definitions
// ============================================================================

export type DiffStatus = 'new' | 'updated' | 'removed' | 'unchanged';

export interface NodeChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface NodeDiff {
  nodeId: string;
  status: DiffStatus;
  changes?: NodeChange[];
}

export interface EdgeDiff {
  edgeId: string;
  status: 'new' | 'removed' | 'unchanged';
}

export interface DiffSummary {
  newNodes: number;
  updatedNodes: number;
  removedNodes: number;
  newEdges: number;
  removedEdges: number;
}

export interface WorkflowDiff {
  nodes: NodeDiff[];
  edges: EdgeDiff[];
  summary: DiffSummary;
  hasChanges: boolean;
}

// Draft types (matching the AI generation format)
export interface WorkflowDraftNode {
  id: string;
  type: 'trigger' | 'condition' | 'action';
  nodeType: string;
  name: string;
  position: [number, number];
  parameters: Record<string, unknown>;
  disabled?: boolean;
}

export interface WorkflowDraftConnections {
  [key: string]: {
    main: Array<Array<{ node: string; index: number }>>;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Deep equality check for objects
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;

  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);

  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!bKeys.includes(key)) return false;
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }

  return true;
}

/**
 * Detect changes between current node and draft node
 */
function detectNodeChanges(
  current: Node<WorkflowNodeData>,
  draft: WorkflowDraftNode
): NodeChange[] {
  const changes: NodeChange[] = [];

  // Compare nodeType
  if (current.data.nodeType !== draft.nodeType) {
    changes.push({
      field: 'nodeType',
      oldValue: current.data.nodeType,
      newValue: draft.nodeType,
    });
  }

  // Compare name/label
  if (current.data.label !== draft.name) {
    changes.push({
      field: 'name',
      oldValue: current.data.label,
      newValue: draft.name,
    });
  }

  // Compare type (trigger/condition/action)
  if (current.data.type !== draft.type) {
    changes.push({
      field: 'type',
      oldValue: current.data.type,
      newValue: draft.type,
    });
  }

  // Deep compare parameters
  if (!deepEqual(current.data.parameters, draft.parameters)) {
    changes.push({
      field: 'parameters',
      oldValue: current.data.parameters,
      newValue: draft.parameters,
    });
  }

  // Compare disabled state
  if (Boolean(current.data.disabled) !== Boolean(draft.disabled)) {
    changes.push({
      field: 'disabled',
      oldValue: current.data.disabled,
      newValue: draft.disabled,
    });
  }

  return changes;
}

/**
 * Convert draft connections to edge IDs for comparison
 */
function connectionsToEdgeIds(connections: WorkflowDraftConnections): Set<string> {
  const edgeIds = new Set<string>();

  Object.entries(connections).forEach(([sourceId, conn]) => {
    conn.main.forEach((outputs, outputIndex) => {
      outputs.forEach((target, targetIdx) => {
        edgeIds.add(`${sourceId}-${target.node}-${outputIndex}-${targetIdx}`);
      });
    });
  });

  return edgeIds;
}

// ============================================================================
// Main Diff Computation
// ============================================================================

/**
 * Compute the diff between current workflow state and a draft
 */
export function computeWorkflowDiff(
  currentNodes: Node<WorkflowNodeData>[],
  currentEdges: Edge[],
  draftNodes: WorkflowDraftNode[],
  draftConnections: WorkflowDraftConnections
): WorkflowDiff {
  const nodeDiffs: NodeDiff[] = [];
  const edgeDiffs: EdgeDiff[] = [];

  // Build maps for quick lookup
  const currentNodeMap = new Map(currentNodes.map((n) => [n.id, n]));
  const draftNodeMap = new Map(draftNodes.map((n) => [n.id, n]));

  // Detect new and updated nodes
  for (const draftNode of draftNodes) {
    const currentNode = currentNodeMap.get(draftNode.id);

    if (!currentNode) {
      // Node exists in draft but not in current = NEW
      nodeDiffs.push({ nodeId: draftNode.id, status: 'new' });
    } else {
      // Node exists in both - check for changes
      const changes = detectNodeChanges(currentNode, draftNode);
      nodeDiffs.push({
        nodeId: draftNode.id,
        status: changes.length > 0 ? 'updated' : 'unchanged',
        changes: changes.length > 0 ? changes : undefined,
      });
    }
  }

  // Detect removed nodes (in current but not in draft)
  for (const currentNode of currentNodes) {
    if (!draftNodeMap.has(currentNode.id)) {
      nodeDiffs.push({ nodeId: currentNode.id, status: 'removed' });
    }
  }

  // Edge diff computation
  const currentEdgeIds = new Set(currentEdges.map((e) => e.id));
  const draftEdgeIds = connectionsToEdgeIds(draftConnections);

  // New edges (in draft but not current)
  for (const edgeId of draftEdgeIds) {
    if (!currentEdgeIds.has(edgeId)) {
      edgeDiffs.push({ edgeId, status: 'new' });
    } else {
      edgeDiffs.push({ edgeId, status: 'unchanged' });
    }
  }

  // Removed edges (in current but not draft)
  for (const edgeId of currentEdgeIds) {
    if (!draftEdgeIds.has(edgeId)) {
      edgeDiffs.push({ edgeId, status: 'removed' });
    }
  }

  // Compute summary
  const summary: DiffSummary = {
    newNodes: nodeDiffs.filter((n) => n.status === 'new').length,
    updatedNodes: nodeDiffs.filter((n) => n.status === 'updated').length,
    removedNodes: nodeDiffs.filter((n) => n.status === 'removed').length,
    newEdges: edgeDiffs.filter((e) => e.status === 'new').length,
    removedEdges: edgeDiffs.filter((e) => e.status === 'removed').length,
  };

  const hasChanges =
    summary.newNodes > 0 ||
    summary.updatedNodes > 0 ||
    summary.removedNodes > 0 ||
    summary.newEdges > 0 ||
    summary.removedEdges > 0;

  return {
    nodes: nodeDiffs,
    edges: edgeDiffs,
    summary,
    hasChanges,
  };
}

/**
 * Get the diff status for a specific node
 */
export function getNodeDiffStatus(
  diff: WorkflowDiff,
  nodeId: string
): { status: DiffStatus; changes?: NodeChange[] } {
  const nodeDiff = diff.nodes.find((n) => n.nodeId === nodeId);
  return nodeDiff
    ? { status: nodeDiff.status, changes: nodeDiff.changes }
    : { status: 'unchanged' };
}

/**
 * Get the diff status for a specific edge
 */
export function getEdgeDiffStatus(
  diff: WorkflowDiff,
  edgeId: string
): 'new' | 'removed' | 'unchanged' {
  const edgeDiff = diff.edges.find((e) => e.edgeId === edgeId);
  return edgeDiff?.status ?? 'unchanged';
}
