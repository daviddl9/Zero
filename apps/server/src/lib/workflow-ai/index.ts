// ============================================================================
// Workflow AI Module
// Single entry point for AI-assisted workflow generation and analysis
// ============================================================================

// ============================================================================
// Schemas
// Zod validation schemas and their inferred TypeScript types
// ============================================================================

export {
  // Node schemas
  WorkflowNodeSchema,
  type WorkflowNode,
  WorkflowConnectionTargetSchema,
  type WorkflowConnectionTarget,
  WorkflowConnectionsSchema,
  type WorkflowConnections,
  // Draft schema
  WorkflowDraftSchema,
  type WorkflowDraft,
  // Generation result
  GenerationResultSchema,
  type GenerationResult,
  // Suggestion schemas
  SuggestionTypeSchema,
  type SuggestionType,
  WorkflowSuggestionSchema,
  type WorkflowSuggestion,
  // Analysis schemas
  ExecutionStatsSchema,
  type ExecutionStats,
  AnalysisResultSchema,
  type AnalysisResult,
} from './schemas';

// ============================================================================
// Prompts
// System prompts and context-building helpers for AI interactions
// ============================================================================

export {
  // System prompts
  WORKFLOW_GENERATOR_PROMPT,
  ANALYSIS_SYSTEM_PROMPT,
  // Types
  type UserContext,
  // Helper functions
  buildSystemPrompt,
  buildAnalysisPrompt as buildAnalysisSystemPrompt,
} from './prompts';

// ============================================================================
// Generator
// Workflow generation and refinement from natural language
// ============================================================================

export {
  // Types
  type GenerationContext,
  // Main functions
  generateWorkflowFromPrompt,
  refineDraftWithFeedback,
  // Utility functions
  sanitizeUserInput,
  applyAutoLayout,
} from './generator';

// ============================================================================
// Analyzer
// Workflow execution analysis and optimization suggestions
// ============================================================================

export {
  // Types
  type Workflow,
  type WorkflowExecution,
  // Main functions
  analyzeWorkflowExecutions,
  computeExecutionStats,
  buildAnalysisPrompt,
  // Helper functions
  filterSuggestionsByConfidence,
  sortSuggestionsByPriority,
} from './analyzer';
