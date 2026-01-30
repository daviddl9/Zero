import { z } from 'zod';

// ============================================================================
// Trigger Types
// ============================================================================

export const TriggerTypeSchema = z.enum([
  'email_received',  // New email arrives
  'email_labeled',   // Label added/removed
  'schedule',        // Cron-based
]);

export type TriggerType = z.infer<typeof TriggerTypeSchema>;

// ============================================================================
// Condition Types
// ============================================================================

export const ConditionTypeSchema = z.enum([
  'sender_match',      // From: pattern
  'subject_match',     // Subject: pattern
  'label_match',       // Has label
  'ai_classification', // AI intent detection
  'keyword_match',     // Body contains
]);

export type ConditionType = z.infer<typeof ConditionTypeSchema>;

// ============================================================================
// Action Types
// ============================================================================

export const ActionTypeSchema = z.enum([
  'mark_read',
  'mark_unread',
  'add_label',
  'remove_label',
  'archive',
  'generate_draft',    // AI draft using skills
  'send_notification', // Push/email notification
  'run_skill',         // Execute existing skill
]);

export type ActionType = z.infer<typeof ActionTypeSchema>;

// ============================================================================
// Workflow Node (internal representation)
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
  })
);

export type WorkflowConnections = z.infer<typeof WorkflowConnectionsSchema>;

// ============================================================================
// Workflow Settings
// ============================================================================

export const WorkflowSettingsSchema = z.object({
  maxExecutionsPerHour: z.number().optional(),
  executionTimeout: z.number().optional(),
  retryOnFailure: z.boolean().optional(),
  maxRetries: z.number().optional(),
}).passthrough();

export type WorkflowSettings = z.infer<typeof WorkflowSettingsSchema>;

// ============================================================================
// n8n-compatible Workflow Definition (for CLI/import/export)
// ============================================================================

export const WorkflowDefinitionNodeSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  type: z.string(), // e.g., 'zero:emailReceived', 'zero:aiClassification'
  typeVersion: z.number().optional(),
  position: z.tuple([z.number(), z.number()]),
  parameters: z.record(z.unknown()),
  disabled: z.boolean().optional(),
});

export type WorkflowDefinitionNode = z.infer<typeof WorkflowDefinitionNodeSchema>;

export const WorkflowDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  active: z.boolean().optional(),
  nodes: z.array(WorkflowDefinitionNodeSchema),
  connections: WorkflowConnectionsSchema,
  settings: WorkflowSettingsSchema.optional(),
});

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

// ============================================================================
// Execution Status
// ============================================================================

export const ExecutionStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
]);

export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

// ============================================================================
// Node Execution Result
// ============================================================================

export const NodeExecutionResultSchema = z.object({
  nodeId: z.string(),
  status: z.enum(['success', 'failure', 'skipped']),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
});

export type NodeExecutionResult = z.infer<typeof NodeExecutionResultSchema>;

// ============================================================================
// Trigger Data (Email context passed to workflows)
// ============================================================================

export const TriggerDataSchema = z.object({
  threadId: z.string(),
  messageId: z.string().optional(),
  subject: z.string().optional(),
  sender: z.string().optional(),
  recipients: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  receivedAt: z.string().datetime().optional(),
  snippet: z.string().optional(),
});

export type TriggerData = z.infer<typeof TriggerDataSchema>;

// ============================================================================
// Notification Provider Types
// ============================================================================

export const NotificationProviderSchema = z.enum([
  'slack',
  'telegram',
  'webhook',
]);

export type NotificationProvider = z.infer<typeof NotificationProviderSchema>;

export const SlackConfigSchema = z.object({
  webhookUrl: z.string().url(),
  channel: z.string().optional(),
});

export const TelegramConfigSchema = z.object({
  botToken: z.string(),
  chatId: z.string(),
});

export const WebhookConfigSchema = z.object({
  url: z.string().url(),
  method: z.enum(['POST', 'GET']).default('POST'),
  headers: z.record(z.string()).optional(),
});

export type SlackConfig = z.infer<typeof SlackConfigSchema>;
export type TelegramConfig = z.infer<typeof TelegramConfigSchema>;
export type WebhookConfig = z.infer<typeof WebhookConfigSchema>;

// ============================================================================
// Action Parameters
// ============================================================================

export const SendNotificationParamsSchema = z.object({
  provider: NotificationProviderSchema,
  config: z.union([SlackConfigSchema, TelegramConfigSchema, WebhookConfigSchema]),
  message: z.string(), // Supports {{variables}} from email
});

export type SendNotificationParams = z.infer<typeof SendNotificationParamsSchema>;

export const GenerateDraftParamsSchema = z.object({
  skillId: z.string().optional(),
  instructions: z.string().optional(),
});

export type GenerateDraftParams = z.infer<typeof GenerateDraftParamsSchema>;

export const AddLabelParamsSchema = z.object({
  label: z.string(),
});

export const RemoveLabelParamsSchema = z.object({
  label: z.string(),
});

export const RunSkillParamsSchema = z.object({
  skillId: z.string(),
});

export type AddLabelParams = z.infer<typeof AddLabelParamsSchema>;
export type RemoveLabelParams = z.infer<typeof RemoveLabelParamsSchema>;
export type RunSkillParams = z.infer<typeof RunSkillParamsSchema>;

// ============================================================================
// Condition Parameters
// ============================================================================

export const SenderMatchParamsSchema = z.object({
  pattern: z.string(), // Glob or regex
});

export const SubjectMatchParamsSchema = z.object({
  pattern: z.string(),
});

export const LabelMatchParamsSchema = z.object({
  labels: z.array(z.string()),
  mode: z.enum(['any', 'all']).default('any'),
});

export const AIClassificationParamsSchema = z.object({
  categories: z.array(z.string()), // e.g., ['promotional', 'urgent']
});

export const KeywordMatchParamsSchema = z.object({
  keywords: z.array(z.string()),
  location: z.enum(['subject', 'body', 'both']).default('both'),
});

export type SenderMatchParams = z.infer<typeof SenderMatchParamsSchema>;
export type SubjectMatchParams = z.infer<typeof SubjectMatchParamsSchema>;
export type LabelMatchParams = z.infer<typeof LabelMatchParamsSchema>;
export type AIClassificationParams = z.infer<typeof AIClassificationParamsSchema>;
export type KeywordMatchParams = z.infer<typeof KeywordMatchParamsSchema>;

// ============================================================================
// Condition Result (for multi-output routing)
// ============================================================================

export const ConditionResultSchema = z.object({
  passed: z.boolean(),
  outputIndex: z.number().optional(), // Which output port (0-based)
  category: z.string().optional(), // Matched category name (for AI classification)
});

export type ConditionResult = z.infer<typeof ConditionResultSchema>;

// ============================================================================
// Trigger Parameters
// ============================================================================

export const EmailReceivedParamsSchema = z.object({
  folder: z.string().optional(), // inbox, all, etc.
});

export const EmailLabeledParamsSchema = z.object({
  label: z.string(),
  action: z.enum(['added', 'removed']),
});

export const ScheduleParamsSchema = z.object({
  cron: z.string(), // e.g., "0 9 * * *"
});

export type EmailReceivedParams = z.infer<typeof EmailReceivedParamsSchema>;
export type EmailLabeledParams = z.infer<typeof EmailLabeledParamsSchema>;
export type ScheduleParams = z.infer<typeof ScheduleParamsSchema>;
