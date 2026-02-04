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
  // New labelling insight types
  'labelling_pattern', // Detected patterns in labelled emails
  'missed_labels', // Emails that should have been labelled
  'expand_criteria', // Suggestions to expand labelling scope
]);

export type SuggestionType = z.infer<typeof SuggestionTypeSchema>;

// ============================================================================
// Workflow Suggestion
// Individual improvement suggestion with proposed fix
// ============================================================================

// Note: proposedFix removed for Gemini API compatibility
// Gemini struggles with deeply nested schemas containing tuples and optional arrays
export const WorkflowSuggestionSchema = z.object({
  type: SuggestionTypeSchema,
  title: z.string().max(80),
  description: z.string().max(500),
  affectedNodeIds: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  priority: z.enum(['low', 'medium', 'high']),
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
// Labelling Stats
// Statistics about how emails are being categorized/labelled
// ============================================================================

export const CategoryDistributionSchema = z.object({
  category: z.string(),
  count: z.number(),
  percentage: z.number(),
});

export type CategoryDistribution = z.infer<typeof CategoryDistributionSchema>;

export const LabelAppliedSchema = z.object({
  label: z.string(),
  count: z.number(),
  percentage: z.number(),
});

export type LabelApplied = z.infer<typeof LabelAppliedSchema>;

export const LabellingStatsSchema = z.object({
  totalClassified: z.number(),
  categoryDistribution: z.array(CategoryDistributionSchema),
  labelsApplied: z.array(LabelAppliedSchema),
  otherCategoryCount: z.number(),
  otherCategoryPercentage: z.number(),
});

export type LabellingStats = z.infer<typeof LabellingStatsSchema>;

// ============================================================================
// Missed Label Candidate
// Emails in "other" category that may have been mislabelled
// Simplified schema for Gemini compatibility (no optional fields in nested arrays)
// ============================================================================

export const MissedLabelCandidateSchema = z.object({
  threadId: z.string(),
  subject: z.string(),
  sender: z.string(),
  reasoning: z.string(),
  suggestedLabel: z.string(),
  confidence: z.number(),
});

export type MissedLabelCandidate = z.infer<typeof MissedLabelCandidateSchema>;

// ============================================================================
// Analysis Result
// Complete response from AI workflow analysis
// ============================================================================

export const AnalysisResultSchema = z.object({
  suggestions: z.array(WorkflowSuggestionSchema),
  executionStats: ExecutionStatsSchema,
  analyzedExecutionIds: z.array(z.string()),
  // New labelling insights fields
  labellingStats: LabellingStatsSchema.optional(),
  missedLabelCandidates: z.array(MissedLabelCandidateSchema).optional(),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
