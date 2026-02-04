// ============================================================================
// Workflow AI Generator
// Generates email workflow drafts from natural language prompts using Gemini
// ============================================================================

import { generateObject } from 'ai';
import {
  GenerationResultSchema,
  type WorkflowDraft,
  type GenerationResult,
  type WorkflowNode,
  type WorkflowConnections,
} from './schemas';
import { buildSystemPrompt, type UserContext } from './prompts';
import { resolveAIClient, getSummarizationModel } from '../ai-client-resolver';
import type { ZeroEnv } from '../../env';

// ============================================================================
// Types
// ============================================================================

export interface GenerationContext {
  existingLabels?: string[];
  existingSkills?: { id: string; name: string; description?: string }[];
}

// ============================================================================
// Layout Constants
// ============================================================================

const LAYOUT = {
  TRIGGER_X: 250,
  TRIGGER_Y: 50,
  NODE_SPACING_Y: 150,
  BRANCH_SPACING_X: 250,
  BASE_X: 250,
} as const;

// ============================================================================
// Main Generator Function
// ============================================================================

/**
 * Generates a workflow draft from a natural language prompt using Gemini.
 *
 * @param prompt - The user's natural language description of the workflow
 * @param context - Optional context including existing labels and skills
 * @param userId - The user's ID for resolving AI client
 * @param env - The environment variables
 * @returns A GenerationResult containing the workflow draft and explanations
 */
export async function generateWorkflowFromPrompt(
  prompt: string,
  context: GenerationContext | undefined,
  userId: string,
  env: ZeroEnv,
): Promise<GenerationResult> {
  // Resolve the AI client based on user settings
  const aiConfig = await resolveAIClient(userId, env);
  const model = getSummarizationModel(aiConfig);

  // Build user context for the system prompt
  const userContext: UserContext = {
    labels: (context?.existingLabels || []).map((name) => ({ id: name, name })),
    skills:
      context?.existingSkills?.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
      })) || [],
  };
  const systemPrompt = buildSystemPrompt(userContext);

  // Generate the workflow using the AI model
  const { object } = await generateObject({
    model,
    schema: GenerationResultSchema,
    system: systemPrompt,
    prompt: sanitizeUserInput(prompt),
    temperature: 0.7,
  });

  // Apply auto-layout to position nodes cleanly
  return {
    ...object,
    draft: applyAutoLayout(object.draft),
  };
}

// ============================================================================
// Refinement Function
// ============================================================================

/**
 * Refines an existing workflow draft based on user feedback.
 *
 * @param existingDraft - The current workflow draft to refine
 * @param feedback - User's feedback or modification request
 * @param context - Optional context including existing labels and skills
 * @param userId - The user's ID for resolving AI client
 * @param env - The environment variables
 * @returns A new GenerationResult with the refined workflow
 */
export async function refineDraftWithFeedback(
  existingDraft: WorkflowDraft,
  feedback: string,
  context: GenerationContext | undefined,
  userId: string,
  env: ZeroEnv,
): Promise<GenerationResult> {
  // Resolve the AI client based on user settings
  const aiConfig = await resolveAIClient(userId, env);
  const model = getSummarizationModel(aiConfig);

  // Build user context for the system prompt
  const userContext: UserContext = {
    labels: (context?.existingLabels || []).map((name) => ({ id: name, name })),
    skills:
      context?.existingSkills?.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
      })) || [],
  };
  const baseSystemPrompt = buildSystemPrompt(userContext);

  // Create a refinement prompt that includes the existing draft
  const refinementSystemPrompt = `${baseSystemPrompt}

## Refinement Mode

You are refining an existing workflow based on user feedback. The current workflow is provided below.
Modify it according to the user's feedback while preserving parts that work well.

**Current Workflow:**
\`\`\`json
${JSON.stringify(existingDraft, null, 2)}
\`\`\`

**Important:**
- Keep node IDs stable where possible (don't rename nodes that aren't being changed)
- Preserve working connections
- Only modify what the user's feedback specifically addresses
- If feedback is unclear, list your assumptions`;

  // Generate the refined workflow
  const { object } = await generateObject({
    model,
    schema: GenerationResultSchema,
    system: refinementSystemPrompt,
    prompt: sanitizeUserInput(feedback),
    temperature: 0.7,
  });

  // Apply auto-layout to the refined draft
  return {
    ...object,
    draft: applyAutoLayout(object.draft),
  };
}

// ============================================================================
// Security Functions
// ============================================================================

/**
 * Sanitizes user input to prevent prompt injection and other security issues.
 *
 * @param input - Raw user input
 * @returns Sanitized input safe for use in AI prompts
 */
export function sanitizeUserInput(input: string): string {
  return (
    input
      // Remove code blocks that could contain injection attempts
      .replace(/```[\s\S]*?```/g, '')
      // Remove single backticks
      .replace(/`/g, '')
      // Remove system/instruction markers that could confuse the model
      .replace(/system:/gi, '')
      .replace(/instruction:/gi, '')
      .replace(/assistant:/gi, '')
      .replace(/user:/gi, '')
      // Remove XML-like tags that might be used for injection
      .replace(/<[^>]*>/g, '')
      // Limit length to prevent context window abuse
      .slice(0, 2000)
      // Trim whitespace
      .trim()
  );
}

// ============================================================================
// Layout Functions
// ============================================================================

/**
 * Applies automatic layout to position workflow nodes in a clean visual arrangement.
 *
 * Layout strategy:
 * - Trigger at the top center
 * - Each subsequent node 150px below the previous
 * - For branching (ai_classification), spread nodes horizontally
 *
 * @param draft - The workflow draft to layout
 * @returns A new draft with updated node positions
 */
export function applyAutoLayout(draft: WorkflowDraft): WorkflowDraft {
  if (!draft.nodes || draft.nodes.length === 0) {
    return draft;
  }

  // Build a map of node connections for traversal
  const connectionMap = buildConnectionMap(draft.connections);

  // Find the trigger node (should be exactly one)
  const triggerNode = draft.nodes.find((n) => n.type === 'trigger');
  if (!triggerNode) {
    // No trigger found, just return with basic vertical layout
    return applyBasicVerticalLayout(draft);
  }

  // Track positioned nodes and their positions
  const positionedNodes = new Map<string, [number, number]>();
  const nodesById = new Map(draft.nodes.map((n) => [n.id, n]));

  // Position trigger at the top
  positionedNodes.set(triggerNode.id, [LAYOUT.TRIGGER_X, LAYOUT.TRIGGER_Y]);

  // BFS to position connected nodes
  const queue: Array<{ nodeId: string; depth: number; branchIndex: number; totalBranches: number }> =
    [];

  // Add initial children of the trigger
  const triggerChildren = connectionMap.get(triggerNode.id) || [];
  triggerChildren.forEach((childId, index) => {
    queue.push({
      nodeId: childId,
      depth: 1,
      branchIndex: index,
      totalBranches: triggerChildren.length,
    });
  });

  // Process nodes in BFS order
  while (queue.length > 0) {
    const { nodeId, depth, branchIndex, totalBranches } = queue.shift()!;

    // Skip if already positioned
    if (positionedNodes.has(nodeId)) {
      continue;
    }

    const node = nodesById.get(nodeId);
    if (!node) {
      continue;
    }

    // Calculate position
    const y = LAYOUT.TRIGGER_Y + depth * LAYOUT.NODE_SPACING_Y;
    let x = LAYOUT.BASE_X;

    // For branching, spread horizontally
    if (totalBranches > 1) {
      const totalWidth = (totalBranches - 1) * LAYOUT.BRANCH_SPACING_X;
      const startX = LAYOUT.BASE_X - totalWidth / 2;
      x = startX + branchIndex * LAYOUT.BRANCH_SPACING_X;
    }

    positionedNodes.set(nodeId, [x, y]);

    // Queue children
    const children = connectionMap.get(nodeId) || [];

    // Check if this is an AI classification node (multiple outputs)
    const isAIClassification = node.nodeType === 'ai_classification';

    children.forEach((childId, index) => {
      if (!positionedNodes.has(childId)) {
        queue.push({
          nodeId: childId,
          depth: depth + 1,
          branchIndex: isAIClassification ? index : branchIndex,
          totalBranches: isAIClassification ? children.length : totalBranches,
        });
      }
    });
  }

  // Position any orphan nodes (not connected to the trigger)
  let orphanY = LAYOUT.TRIGGER_Y + (positionedNodes.size + 1) * LAYOUT.NODE_SPACING_Y;
  for (const node of draft.nodes) {
    if (!positionedNodes.has(node.id)) {
      positionedNodes.set(node.id, [LAYOUT.BASE_X, orphanY]);
      orphanY += LAYOUT.NODE_SPACING_Y;
    }
  }

  // Create new nodes array with updated positions
  const layoutedNodes: WorkflowNode[] = draft.nodes.map((node) => {
    const position = positionedNodes.get(node.id) || node.position;
    return {
      ...node,
      position: position as [number, number],
    };
  });

  return {
    ...draft,
    nodes: layoutedNodes,
  };
}

/**
 * Builds a map of parent node IDs to their child node IDs based on connections.
 */
function buildConnectionMap(connections: WorkflowConnections): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const [sourceId, sourceConnections] of Object.entries(connections)) {
    const children: string[] = [];

    if (sourceConnections.main) {
      for (const outputConnections of sourceConnections.main) {
        for (const connection of outputConnections) {
          if (connection.node && !children.includes(connection.node)) {
            children.push(connection.node);
          }
        }
      }
    }

    map.set(sourceId, children);
  }

  return map;
}

/**
 * Applies a basic vertical layout when no trigger is found.
 */
function applyBasicVerticalLayout(draft: WorkflowDraft): WorkflowDraft {
  const layoutedNodes: WorkflowNode[] = draft.nodes.map((node, index) => ({
    ...node,
    position: [LAYOUT.BASE_X, LAYOUT.TRIGGER_Y + index * LAYOUT.NODE_SPACING_Y] as [number, number],
  }));

  return {
    ...draft,
    nodes: layoutedNodes,
  };
}
