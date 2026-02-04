import { z } from 'zod';

// ============================================================================
// Workflow AI Schemas
// Defines validation schemas for AI-assisted workflow generation and analysis
// ============================================================================

// ============================================================================
// Workflow Node (for AI drafts)
// Mirrors WorkflowNodeSchema from workflow-engine/types.ts
// ============================================================================

export const WorkflowNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['trigger', 'condition', 'action']),
  nodeType: z.string(), // Specific node type: 'ai_classification', 'email_received', etc.
  name: z.string(),
  position: z.tuple([z.number(), z.number()]), // Canvas coordinates [x, y]
  parameters: z.record(z.unknown()),
  disabled: z.boolean().optional(),
});

export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;

// ============================================================================
// Workflow Connections (n8n-style)
// Mirrors WorkflowConnectionsSchema from workflow-engine/types.ts
// ============================================================================

export const WorkflowConnectionTargetSchema = z.object({
  node: z.string(),
  index: z.number(),
});

export type WorkflowConnectionTarget = z.infer<typeof WorkflowConnectionTargetSchema>;

export const WorkflowConnectionsSchema = z.record(
  z.string(),
  z.object({
    main: z.array(z.array(WorkflowConnectionTargetSchema)),
  }),
);

export type WorkflowConnections = z.infer<typeof WorkflowConnectionsSchema>;

// ============================================================================
// Workflow Draft
// The structured workflow output from AI generation
// ============================================================================

export const WorkflowDraftSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  nodes: z.array(WorkflowNodeSchema),
  connections: WorkflowConnectionsSchema,
});

export type WorkflowDraft = z.infer<typeof WorkflowDraftSchema>;

// ============================================================================
// Generation Result
// Complete response from AI workflow generation
// ============================================================================

export const GenerationResultSchema = z.object({
  draft: WorkflowDraftSchema,
  explanation: z.string(),
  assumptions: z.array(z.string()),
  questions: z.array(z.string()).optional(),
});

export type GenerationResult = z.infer<typeof GenerationResultSchema>;

// ============================================================================
// Suggestion Types
// Categories of workflow improvements the AI can suggest
// ============================================================================

export const SuggestionTypeSchema = z.enum([
  'node_optimization',
  'missing_error_handling',
  'performance',
  'redundancy',
  'ai_classification_tuning',
  'missing_condition',
  'action_sequencing',
]);

export type SuggestionType = z.infer<typeof SuggestionTypeSchema>;

// ============================================================================
// Workflow Suggestion
// Individual improvement suggestion with proposed fix
// ============================================================================

export const WorkflowSuggestionSchema = z.object({
  type: SuggestionTypeSchema,
  title: z.string().max(80),
  description: z.string().max(500),
  affectedNodeIds: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  priority: z.enum(['low', 'medium', 'high']),
  proposedFix: z
    .object({
      addNodes: z.array(WorkflowNodeSchema).optional(),
      removeNodeIds: z.array(z.string()).optional(),
      updateConnections: WorkflowConnectionsSchema.optional(),
    })
    .optional(),
});

export type WorkflowSuggestion = z.infer<typeof WorkflowSuggestionSchema>;

// ============================================================================
// Execution Stats
// Statistics from workflow execution history analysis
// ============================================================================

export const ExecutionStatsSchema = z.object({
  totalExecutions: z.number(),
  successRate: z.number(),
  averageDuration: z.number().optional(),
  commonFailureNodes: z.array(z.string()),
});

export type ExecutionStats = z.infer<typeof ExecutionStatsSchema>;

// ============================================================================
// Analysis Result
// Complete response from AI workflow analysis
// ============================================================================

export const AnalysisResultSchema = z.object({
  suggestions: z.array(WorkflowSuggestionSchema),
  executionStats: ExecutionStatsSchema,
  analyzedExecutionIds: z.array(z.string()),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
