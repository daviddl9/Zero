// ============================================================================
// Workflow AI Analyzer
// Analyzes workflow execution history and suggests improvements using Gemini
// ============================================================================

import { generateObject } from 'ai';
import {
  AnalysisResultSchema,
  type AnalysisResult,
  type ExecutionStats,
  type WorkflowSuggestion,
  type LabellingStats,
  type CategoryDistribution,
  type LabelApplied,
} from './schemas';
import { ANALYSIS_SYSTEM_PROMPT } from './prompts';
import { resolveAIClient, getSummarizationModel } from '../ai-client-resolver';
import type { ZeroEnv } from '../../env';
import type {
  WorkflowNode,
  WorkflowConnections,
  ExecutionStatus,
  TriggerData,
  NodeExecutionResult,
} from '../workflow-engine/types';

// ============================================================================
// Types (minimal interfaces matching database schema)
// ============================================================================

/**
 * Minimal workflow interface matching the database schema.
 * Includes only the fields needed for analysis.
 */
export interface Workflow {
  id: string;
  name: string;
  description?: string | null;
  nodes: WorkflowNode[];
  connections: WorkflowConnections;
}

/**
 * Minimal workflow execution interface matching the database schema.
 * Includes only the fields needed for analysis.
 */
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  threadId?: string | null;
  status: ExecutionStatus;
  triggerData?: TriggerData | null;
  nodeResults?: NodeExecutionResult[] | null;
  error?: string | null;
  startedAt: Date;
  completedAt?: Date | null;
}

// ============================================================================
// Pre-computed Statistics
// ============================================================================

/**
 * Computes statistics from workflow execution history.
 *
 * @param executions - Array of workflow executions to analyze
 * @returns Computed execution statistics
 */
export function computeExecutionStats(executions: WorkflowExecution[]): ExecutionStats {
  if (executions.length === 0) {
    return {
      totalExecutions: 0,
      successRate: 0,
      averageDuration: undefined,
      commonFailureNodes: [],
    };
  }

  const totalExecutions = executions.length;

  // Calculate success rate
  const completedExecutions = executions.filter((e) => e.status === 'completed');
  const successRate = completedExecutions.length / totalExecutions;

  // Calculate average duration for completed executions
  const durations: number[] = [];
  for (const execution of executions) {
    if (execution.completedAt && execution.startedAt) {
      const startTime = execution.startedAt.getTime();
      const endTime = execution.completedAt.getTime();
      if (endTime > startTime) {
        durations.push(endTime - startTime);
      }
    }
  }
  const averageDuration =
    durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : undefined;

  // Find common failure nodes
  const failureNodeCounts = new Map<string, number>();
  const failedExecutions = executions.filter((e) => e.status === 'failed');

  for (const execution of failedExecutions) {
    if (execution.nodeResults) {
      for (const result of execution.nodeResults) {
        if (result.status === 'failure') {
          const count = failureNodeCounts.get(result.nodeId) || 0;
          failureNodeCounts.set(result.nodeId, count + 1);
        }
      }
    }
  }

  // Sort by frequency and take top 5
  const sortedFailureNodes = [...failureNodeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nodeId]) => nodeId);

  return {
    totalExecutions,
    successRate,
    averageDuration,
    commonFailureNodes: sortedFailureNodes,
  };
}

// ============================================================================
// Labelling Statistics
// ============================================================================

/**
 * Represents an email that was classified into the "other" category
 */
interface OtherCategoryEmail {
  threadId: string;
  subject?: string;
  sender?: string;
  category: string;
}

/**
 * Checks if a workflow has AI classification nodes.
 */
function hasAIClassification(workflow: Workflow): boolean {
  return workflow.nodes.some((node) => node.nodeType === 'ai_classification');
}

/**
 * Gets the AI classification categories from a workflow.
 */
function getAIClassificationCategories(workflow: Workflow): string[] {
  const aiNode = workflow.nodes.find((node) => node.nodeType === 'ai_classification');
  if (!aiNode || !aiNode.parameters) return [];

  const categories = aiNode.parameters.categories;
  if (Array.isArray(categories)) {
    return categories.filter((c): c is string => typeof c === 'string');
  }
  return [];
}

/**
 * Computes labelling statistics from workflow execution history.
 * Only applicable to workflows with AI classification nodes.
 *
 * @param executions - Array of workflow executions to analyze
 * @param workflow - The workflow definition
 * @returns Labelling statistics or null if not applicable
 */
export function computeLabellingStats(
  executions: WorkflowExecution[],
  workflow: Workflow,
): LabellingStats | null {
  // Only compute for workflows with AI classification
  if (!hasAIClassification(workflow)) {
    return null;
  }

  const categories = getAIClassificationCategories(workflow);
  if (categories.length === 0) {
    return null;
  }

  // Count classifications by category
  const categoryCounts = new Map<string, number>();
  const labelCounts = new Map<string, number>();
  let totalClassified = 0;

  for (const execution of executions) {
    if (execution.status !== 'completed' || !execution.nodeResults) continue;

    for (const result of execution.nodeResults) {
      // Check if this is an AI classification result
      const output = result.output as { category?: string; reasoning?: string } | undefined;
      if (output?.category) {
        totalClassified++;
        const count = categoryCounts.get(output.category) || 0;
        categoryCounts.set(output.category, count + 1);
      }

      // Check if this is an add_label action
      const node = workflow.nodes.find((n) => n.id === result.nodeId);
      if (node?.nodeType === 'add_label' && result.status === 'success') {
        const label = (node.parameters as { label?: string })?.label;
        if (label) {
          const count = labelCounts.get(label) || 0;
          labelCounts.set(label, count + 1);
        }
      }
    }
  }

  if (totalClassified === 0) {
    return null;
  }

  // Build category distribution
  const categoryDistribution: CategoryDistribution[] = [];
  for (const category of categories) {
    const count = categoryCounts.get(category) || 0;
    categoryDistribution.push({
      category,
      count,
      percentage: totalClassified > 0 ? (count / totalClassified) * 100 : 0,
    });
  }

  // Add "other" category
  const otherCount = categoryCounts.get('other') || 0;
  categoryDistribution.push({
    category: 'other',
    count: otherCount,
    percentage: totalClassified > 0 ? (otherCount / totalClassified) * 100 : 0,
  });

  // Build labels applied
  const labelsApplied: LabelApplied[] = [];
  for (const [label, count] of labelCounts) {
    labelsApplied.push({
      label,
      count,
      percentage: totalClassified > 0 ? (count / totalClassified) * 100 : 0,
    });
  }

  // Sort by count descending
  categoryDistribution.sort((a, b) => b.count - a.count);
  labelsApplied.sort((a, b) => b.count - a.count);

  return {
    totalClassified,
    categoryDistribution,
    labelsApplied,
    otherCategoryCount: otherCount,
    otherCategoryPercentage: totalClassified > 0 ? (otherCount / totalClassified) * 100 : 0,
  };
}

/**
 * Extracts emails that were classified into the "other" category.
 * These are candidates for missed labels.
 *
 * @param executions - Array of workflow executions to analyze
 * @param workflow - The workflow definition
 * @returns Array of emails in the "other" category with metadata
 */
export function extractOtherCategoryEmails(
  executions: WorkflowExecution[],
  workflow: Workflow,
): OtherCategoryEmail[] {
  if (!hasAIClassification(workflow)) {
    return [];
  }

  const otherEmails: OtherCategoryEmail[] = [];

  for (const execution of executions) {
    if (execution.status !== 'completed' || !execution.nodeResults) continue;

    for (const result of execution.nodeResults) {
      const output = result.output as { category?: string } | undefined;
      if (output?.category === 'other') {
        otherEmails.push({
          threadId: execution.threadId || execution.id,
          subject: execution.triggerData?.subject || undefined,
          sender: execution.triggerData?.sender || undefined,
          category: 'other',
        });
        break; // Only add once per execution
      }
    }
  }

  return otherEmails;
}

// ============================================================================
// Analysis Prompt Builder
// ============================================================================

/**
 * Formats workflow definition and execution history into a structured prompt
 * for AI analysis.
 *
 * @param workflow - The workflow to analyze
 * @param executions - Execution history for the workflow
 * @param stats - Pre-computed execution statistics
 * @param labellingStats - Optional labelling statistics for AI classification workflows
 * @param otherCategoryEmails - Optional list of emails in "other" category
 * @returns Formatted prompt string for AI analysis
 */
export function buildAnalysisPrompt(
  workflow: Workflow,
  executions: WorkflowExecution[],
  stats: ExecutionStats,
  labellingStats?: LabellingStats | null,
  otherCategoryEmails?: OtherCategoryEmail[],
): string {
  // Format workflow definition
  const workflowDefinition = {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    nodes: workflow.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      nodeType: node.nodeType,
      name: node.name,
      parameters: node.parameters,
      disabled: node.disabled,
    })),
    connections: workflow.connections,
  };

  // Format execution history summary (limit to most recent 50 for context)
  const recentExecutions = executions.slice(0, 50);
  const executionSummaries = recentExecutions.map((execution) => {
    const duration =
      execution.completedAt && execution.startedAt
        ? execution.completedAt.getTime() - execution.startedAt.getTime()
        : null;

    const failedNodes = execution.nodeResults
      ?.filter((r) => r.status === 'failure')
      .map((r) => ({
        nodeId: r.nodeId,
        error: r.error,
      }));

    return {
      id: execution.id,
      status: execution.status,
      durationMs: duration,
      failedNodes: failedNodes?.length ? failedNodes : undefined,
      hasError: !!execution.error,
    };
  });

  // Build labelling context section if applicable
  let labellingSection = '';
  if (labellingStats) {
    const categoryLines = labellingStats.categoryDistribution
      .map((c) => `  - ${c.category}: ${c.count} (${c.percentage.toFixed(1)}%)`)
      .join('\n');

    const labelLines =
      labellingStats.labelsApplied.length > 0
        ? labellingStats.labelsApplied
            .map((l) => `  - ${l.label}: ${l.count} (${l.percentage.toFixed(1)}%)`)
            .join('\n')
        : '  (No labels applied)';

    labellingSection = `

### Labelling Statistics
- Total Classified: ${labellingStats.totalClassified}
- Other Category Rate: ${labellingStats.otherCategoryPercentage.toFixed(1)}%

#### Category Distribution
${categoryLines}

#### Labels Applied
${labelLines}`;

    // Add sample "other" category emails if available
    if (otherCategoryEmails && otherCategoryEmails.length > 0) {
      const sampleEmails = otherCategoryEmails.slice(0, 10); // Limit to 10 samples
      const emailLines = sampleEmails
        .map(
          (e) =>
            `  - Subject: "${e.subject || '(no subject)'}" | From: ${e.sender || '(unknown)'}`,
        )
        .join('\n');

      labellingSection += `

#### Sample Emails in "Other" Category (${otherCategoryEmails.length} total)
${emailLines}`;
    }
  }

  // Build the analysis prompt
  const prompt = `## Workflow to Analyze

### Definition
\`\`\`json
${JSON.stringify(workflowDefinition, null, 2)}
\`\`\`

### Pre-computed Statistics
- Total Executions: ${stats.totalExecutions}
- Success Rate: ${(stats.successRate * 100).toFixed(1)}%
- Average Duration: ${stats.averageDuration ? `${stats.averageDuration.toFixed(0)}ms` : 'N/A'}
- Common Failure Nodes: ${stats.commonFailureNodes.length > 0 ? stats.commonFailureNodes.join(', ') : 'None'}${labellingSection}

### Recent Execution History (${recentExecutions.length} executions)
\`\`\`json
${JSON.stringify(executionSummaries, null, 2)}
\`\`\`

### Execution IDs Analyzed
${recentExecutions.map((e) => e.id).join(', ')}

## Task

Analyze this workflow and its execution history. Identify:
1. Performance bottlenecks (nodes that take too long or fail often)
2. Missing error handling (actions without fallbacks)
3. Optimization opportunities (redundant checks, inefficient ordering)
4. AI classification tuning (if applicable)
${labellingStats ? `5. Labelling patterns and potential missed labels
6. Opportunities to expand labelling criteria` : ''}

Provide actionable suggestions with concrete fixes where possible.`;

  return prompt;
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Analyzes workflow execution history using Gemini AI and returns suggestions
 * for improvements along with computed statistics.
 *
 * @param workflow - The workflow to analyze
 * @param executions - Execution history for the workflow
 * @param userId - The user's ID for resolving AI client
 * @param env - The environment variables
 * @returns Analysis result with suggestions and statistics
 */
export async function analyzeWorkflowExecutions(
  workflow: Workflow,
  executions: WorkflowExecution[],
  userId: string,
  env: ZeroEnv,
): Promise<AnalysisResult> {
  // Compute statistics first
  const stats = computeExecutionStats(executions);

  // If no executions, return minimal analysis
  if (executions.length === 0) {
    return {
      suggestions: [],
      executionStats: stats,
      analyzedExecutionIds: [],
    };
  }

  // Compute labelling statistics for AI classification workflows
  const labellingStats = computeLabellingStats(executions, workflow);
  const otherCategoryEmails = extractOtherCategoryEmails(executions, workflow);

  // Resolve the AI client based on user settings
  const aiConfig = await resolveAIClient(userId, env);
  const model = getSummarizationModel(aiConfig);

  // Build the analysis prompt with labelling context
  const userPrompt = buildAnalysisPrompt(
    workflow,
    executions,
    stats,
    labellingStats,
    otherCategoryEmails,
  );

  // Generate analysis using AI
  const { object } = await generateObject({
    model,
    schema: AnalysisResultSchema,
    system: ANALYSIS_SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.5, // Lower temperature for more consistent analysis
  });

  // Merge pre-computed stats with AI response
  // (AI may not calculate stats accurately, so we override with our computed values)
  return {
    ...object,
    executionStats: stats,
    analyzedExecutionIds: executions.slice(0, 50).map((e) => e.id),
    // Include labelling data if available
    labellingStats: labellingStats ?? undefined,
    missedLabelCandidates: object.missedLabelCandidates,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Filters suggestions by minimum confidence threshold.
 *
 * @param suggestions - Array of suggestions to filter
 * @param minConfidence - Minimum confidence score (0-1)
 * @returns Filtered suggestions
 */
export function filterSuggestionsByConfidence(
  suggestions: WorkflowSuggestion[],
  minConfidence: number,
): WorkflowSuggestion[] {
  return suggestions.filter((s) => s.confidence >= minConfidence);
}

/**
 * Sorts suggestions by priority (high first) and confidence.
 *
 * @param suggestions - Array of suggestions to sort
 * @returns Sorted suggestions
 */
export function sortSuggestionsByPriority(
  suggestions: WorkflowSuggestion[],
): WorkflowSuggestion[] {
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return [...suggestions].sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.confidence - a.confidence;
  });
}
