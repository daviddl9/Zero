import { describe, it, expect } from 'vitest';
import {
  WorkflowNodeSchema,
  WorkflowConnectionsSchema,
  WorkflowSettingsSchema,
  TriggerTypeSchema,
  ConditionTypeSchema,
  ActionTypeSchema,
  WorkflowDefinitionSchema,
  type WorkflowNode,
  type WorkflowConnections,
  type WorkflowSettings,
  type TriggerType,
  type ConditionType,
  type ActionType,
  type WorkflowDefinition,
} from './types';

describe('Workflow Types', () => {
  describe('WorkflowNodeSchema', () => {
    it('should validate a valid trigger node', () => {
      const triggerNode: WorkflowNode = {
        id: 'trigger-1',
        type: 'trigger',
        nodeType: 'email_received',
        name: 'Email Received',
        position: [100, 200],
        parameters: { folder: 'inbox' },
      };

      const result = WorkflowNodeSchema.safeParse(triggerNode);
      expect(result.success).toBe(true);
    });

    it('should validate a valid condition node', () => {
      const conditionNode: WorkflowNode = {
        id: 'condition-1',
        type: 'condition',
        nodeType: 'ai_classification',
        name: 'Is Promotional',
        position: [300, 200],
        parameters: { categories: ['promotional', 'marketing'] },
      };

      const result = WorkflowNodeSchema.safeParse(conditionNode);
      expect(result.success).toBe(true);
    });

    it('should validate a valid action node', () => {
      const actionNode: WorkflowNode = {
        id: 'action-1',
        type: 'action',
        nodeType: 'mark_read',
        name: 'Mark as Read',
        position: [500, 200],
        parameters: {},
      };

      const result = WorkflowNodeSchema.safeParse(actionNode);
      expect(result.success).toBe(true);
    });

    it('should validate a disabled node', () => {
      const disabledNode: WorkflowNode = {
        id: 'action-1',
        type: 'action',
        nodeType: 'mark_read',
        name: 'Mark as Read',
        position: [500, 200],
        parameters: {},
        disabled: true,
      };

      const result = WorkflowNodeSchema.safeParse(disabledNode);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.disabled).toBe(true);
      }
    });

    it('should reject a node with invalid type', () => {
      const invalidNode = {
        id: 'node-1',
        type: 'invalid_type',
        name: 'Invalid Node',
        position: [100, 200],
        parameters: {},
      };

      const result = WorkflowNodeSchema.safeParse(invalidNode);
      expect(result.success).toBe(false);
    });

    it('should reject a node without required fields', () => {
      const incompleteNode = {
        id: 'node-1',
        type: 'trigger',
      };

      const result = WorkflowNodeSchema.safeParse(incompleteNode);
      expect(result.success).toBe(false);
    });
  });

  describe('WorkflowConnectionsSchema', () => {
    it('should validate valid n8n-style connections', () => {
      const connections: WorkflowConnections = {
        'trigger-1': {
          main: [[{ node: 'condition-1', index: 0 }]],
        },
        'condition-1': {
          main: [[{ node: 'action-1', index: 0 }, { node: 'action-2', index: 0 }]],
        },
      };

      const result = WorkflowConnectionsSchema.safeParse(connections);
      expect(result.success).toBe(true);
    });

    it('should validate empty connections', () => {
      const connections: WorkflowConnections = {};

      const result = WorkflowConnectionsSchema.safeParse(connections);
      expect(result.success).toBe(true);
    });

    it('should validate connections with multiple outputs', () => {
      const connections: WorkflowConnections = {
        'condition-1': {
          main: [
            [{ node: 'action-true', index: 0 }],   // Output 0 (true branch)
            [{ node: 'action-false', index: 0 }],  // Output 1 (false branch)
          ],
        },
      };

      const result = WorkflowConnectionsSchema.safeParse(connections);
      expect(result.success).toBe(true);
    });
  });

  describe('TriggerTypeSchema', () => {
    it('should validate all trigger types', () => {
      const validTypes: TriggerType[] = ['email_received', 'email_labeled', 'schedule'];

      for (const type of validTypes) {
        const result = TriggerTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid trigger type', () => {
      const result = TriggerTypeSchema.safeParse('invalid_trigger');
      expect(result.success).toBe(false);
    });
  });

  describe('ConditionTypeSchema', () => {
    it('should validate all condition types', () => {
      const validTypes: ConditionType[] = [
        'sender_match',
        'subject_match',
        'label_match',
        'ai_classification',
        'keyword_match',
      ];

      for (const type of validTypes) {
        const result = ConditionTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid condition type', () => {
      const result = ConditionTypeSchema.safeParse('invalid_condition');
      expect(result.success).toBe(false);
    });
  });

  describe('ActionTypeSchema', () => {
    it('should validate all action types', () => {
      const validTypes: ActionType[] = [
        'mark_read',
        'mark_unread',
        'add_label',
        'remove_label',
        'archive',
        'generate_draft',
        'send_notification',
        'run_skill',
      ];

      for (const type of validTypes) {
        const result = ActionTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid action type', () => {
      const result = ActionTypeSchema.safeParse('invalid_action');
      expect(result.success).toBe(false);
    });
  });

  describe('WorkflowSettingsSchema', () => {
    it('should validate workflow settings with all fields', () => {
      const settings: WorkflowSettings = {
        maxExecutionsPerHour: 100,
        executionTimeout: 30000,
        retryOnFailure: true,
        maxRetries: 3,
      };

      const result = WorkflowSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
    });

    it('should validate partial workflow settings', () => {
      const settings = {
        maxExecutionsPerHour: 50,
      };

      const result = WorkflowSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
    });

    it('should validate empty workflow settings', () => {
      const result = WorkflowSettingsSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('WorkflowDefinitionSchema (n8n-compatible JSON)', () => {
    it('should validate a complete n8n-compatible workflow definition', () => {
      const definition: WorkflowDefinition = {
        name: 'mark-promos-read',
        description: 'Automatically mark promotional emails as read',
        active: true,
        nodes: [
          {
            id: 'trigger-1',
            name: 'Email Received',
            type: 'zero:emailReceived',
            typeVersion: 1,
            position: [100, 200],
            parameters: { folder: 'inbox' },
          },
          {
            id: 'condition-1',
            name: 'Is Promotional',
            type: 'zero:aiClassification',
            typeVersion: 1,
            position: [300, 200],
            parameters: { categories: ['promotional', 'marketing'] },
          },
          {
            id: 'action-1',
            name: 'Mark as Read',
            type: 'zero:markRead',
            typeVersion: 1,
            position: [500, 200],
            parameters: {},
          },
        ],
        connections: {
          'trigger-1': {
            main: [[{ node: 'condition-1', index: 0 }]],
          },
          'condition-1': {
            main: [[{ node: 'action-1', index: 0 }]],
          },
        },
      };

      const result = WorkflowDefinitionSchema.safeParse(definition);
      expect(result.success).toBe(true);
    });

    it('should validate a minimal workflow definition', () => {
      const definition: WorkflowDefinition = {
        name: 'simple-workflow',
        nodes: [],
        connections: {},
      };

      const result = WorkflowDefinitionSchema.safeParse(definition);
      expect(result.success).toBe(true);
    });

    it('should reject a workflow without a name', () => {
      const definition = {
        nodes: [],
        connections: {},
      };

      const result = WorkflowDefinitionSchema.safeParse(definition);
      expect(result.success).toBe(false);
    });

    it('should validate n8n-style node types with version', () => {
      const definition: WorkflowDefinition = {
        name: 'test-workflow',
        nodes: [
          {
            id: 't1',
            type: 'zero:emailReceived',
            typeVersion: 1,
            position: [100, 200],
            parameters: {},
          },
        ],
        connections: {},
      };

      const result = WorkflowDefinitionSchema.safeParse(definition);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nodes[0].typeVersion).toBe(1);
      }
    });
  });
});
