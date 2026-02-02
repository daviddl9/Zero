import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the AI client resolver to avoid Cloudflare Workers dependency
vi.mock('../ai-client-resolver', () => ({
  resolveAIClient: vi.fn().mockResolvedValue({
    provider: 'gemini',
    google: vi.fn(),
    defaultModel: 'gemini-pro',
    summarizationModel: 'gemini-flash',
    isUserConfigured: false,
  }),
  getSummarizationModel: vi.fn().mockReturnValue('mock-model'),
}));

// Mock ai module
vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      category: 'promotional',
      reasoning: 'This email contains promotional content.',
    },
  }),
}));

import { WorkflowExecutor, type ExecutorDependencies } from './executor';
import type { WorkflowDefinition } from './types';

// Mock action context (matches ActionContext interface from actions.ts)
const mockModifyThread = vi.fn().mockResolvedValue(undefined);
const mockGetLabels = vi.fn().mockResolvedValue([
  { id: 'INBOX', name: 'Inbox' },
  { id: 'IMPORTANT', name: 'Important' },
]);

const mockActionContext = {
  connectionId: 'conn-123',
  modifyThread: mockModifyThread,
  getLabels: mockGetLabels,
};

// Mock database
const mockDb = {
  query: {
    workflow: {
      findFirst: vi.fn(),
    },
    workflowExecution: {
      findFirst: vi.fn(),
    },
  },
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  }),
};

// Mock environment
const mockEnv = {
  GOOGLE_GENERATIVE_AI_API_KEY: 'test-key',
} as any;

describe('WorkflowExecutor', () => {
  let executor: WorkflowExecutor;
  let deps: ExecutorDependencies;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = {
      db: mockDb as any,
      actionContext: mockActionContext as any,
      userId: 'test-user-123',
      env: mockEnv,
    };
    executor = new WorkflowExecutor(deps);
  });

  const sampleWorkflow: WorkflowDefinition = {
    id: 'wf-1',
    name: 'Test Workflow',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        nodeType: 'email_received',
        name: 'Email Received',
        position: [0, 0],
        parameters: {},
      },
      {
        id: 'condition-1',
        type: 'condition',
        nodeType: 'sender_match',
        name: 'Check Sender',
        position: [100, 0],
        parameters: { pattern: '*@example.com' },
      },
      {
        id: 'action-1',
        type: 'action',
        nodeType: 'mark_read',
        name: 'Mark Read',
        position: [200, 0],
        parameters: {},
      },
    ],
    connections: {
      'trigger-1': { main: [[{ node: 'condition-1', index: 0 }]] },
      'condition-1': { main: [[{ node: 'action-1', index: 0 }]] },
    },
  };

  const sampleExecution = {
    id: 'exec-1',
    workflowId: 'wf-1',
    threadId: 'thread-456',
    status: 'pending',
    triggerData: {
      event: 'email_received',
      thread: {
        id: 'thread-456',
        subject: 'Test Email',
        sender: { name: 'John', email: 'john@example.com' },
        labels: [{ id: 'INBOX', name: 'Inbox' }],
        receivedOn: new Date().toISOString(),
        unread: true,
        body: 'Test body',
      },
    },
    nodeResults: {},
    startedAt: new Date(),
  };

  describe('execute', () => {
    it('should execute a simple workflow successfully', async () => {
      mockDb.query.workflowExecution.findFirst.mockResolvedValue(sampleExecution);
      mockDb.query.workflow.findFirst.mockResolvedValue(sampleWorkflow);

      const result = await executor.execute('exec-1');

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.nodeResults).toBeDefined();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should mark execution as failed when workflow not found', async () => {
      mockDb.query.workflowExecution.findFirst.mockResolvedValue(sampleExecution);
      mockDb.query.workflow.findFirst.mockResolvedValue(null);

      const result = await executor.execute('exec-1');

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toContain('not found');
    });

    it('should mark execution as failed when execution record not found', async () => {
      mockDb.query.workflowExecution.findFirst.mockResolvedValue(null);

      const result = await executor.execute('exec-1');

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toContain('not found');
    });

    it('should skip already completed executions', async () => {
      mockDb.query.workflowExecution.findFirst.mockResolvedValue({
        ...sampleExecution,
        status: 'completed',
      });

      const result = await executor.execute('exec-1');

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.skipped).toBe(true);
    });

    it('should stop execution when condition fails', async () => {
      mockDb.query.workflowExecution.findFirst.mockResolvedValue({
        ...sampleExecution,
        triggerData: {
          ...sampleExecution.triggerData,
          thread: {
            ...sampleExecution.triggerData.thread,
            sender: { name: 'Jane', email: 'jane@other.com' }, // Won't match pattern
          },
        },
      });
      mockDb.query.workflow.findFirst.mockResolvedValue(sampleWorkflow);

      const result = await executor.execute('exec-1');

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      // Action should not have been executed because condition failed
      expect(mockModifyThread).not.toHaveBeenCalled();
    });

    it('should execute actions when conditions pass', async () => {
      mockDb.query.workflowExecution.findFirst.mockResolvedValue(sampleExecution);
      mockDb.query.workflow.findFirst.mockResolvedValue(sampleWorkflow);

      await executor.execute('exec-1');

      // mark_read action removes UNREAD label via modifyThread
      expect(mockModifyThread).toHaveBeenCalledWith('thread-456', {
        addLabels: [],
        removeLabels: ['UNREAD'],
      });
    });
  });

  describe('executeNode', () => {
    it('should return true for trigger nodes', async () => {
      const triggerNode = sampleWorkflow.nodes[0];
      const result = await executor.executeNode(triggerNode, sampleExecution.triggerData);

      expect(result.executed).toBe(true);
      expect(result.passed).toBe(true);
    });

    it('should evaluate condition nodes', async () => {
      const conditionNode = sampleWorkflow.nodes[1];
      const result = await executor.executeNode(conditionNode, sampleExecution.triggerData);

      expect(result.executed).toBe(true);
      expect(result.passed).toBe(true); // john@example.com matches *@example.com
    });

    it('should execute action nodes', async () => {
      const actionNode = sampleWorkflow.nodes[2];
      const result = await executor.executeNode(actionNode, sampleExecution.triggerData);

      expect(result.executed).toBe(true);
      expect(result.passed).toBe(true);
      expect(mockModifyThread).toHaveBeenCalled();
    });
  });

  describe('getExecutionOrder', () => {
    it('should return nodes in topological order starting from trigger', () => {
      const order = executor.getExecutionOrder(sampleWorkflow, 'trigger-1');

      expect(order).toHaveLength(3);
      expect(order[0].id).toBe('trigger-1');
      expect(order[1].id).toBe('condition-1');
      expect(order[2].id).toBe('action-1');
    });

    it('should handle workflow with parallel actions', () => {
      const parallelWorkflow: WorkflowDefinition = {
        id: 'wf-2',
        name: 'Parallel Workflow',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            nodeType: 'email_received',
            name: 'Trigger',
            position: [0, 0],
            parameters: {},
          },
          {
            id: 'action-1',
            type: 'action',
            nodeType: 'mark_read',
            name: 'Mark Read',
            position: [100, 0],
            parameters: {},
          },
          {
            id: 'action-2',
            type: 'action',
            nodeType: 'add_label',
            name: 'Add Label',
            position: [100, 100],
            parameters: { label: 'Test' },
          },
        ],
        connections: {
          'trigger-1': {
            main: [[{ node: 'action-1', index: 0 }, { node: 'action-2', index: 0 }]],
          },
        },
      };

      const order = executor.getExecutionOrder(parallelWorkflow, 'trigger-1');

      expect(order).toHaveLength(3);
      expect(order[0].id).toBe('trigger-1');
      // Both actions should be included (order may vary)
      const actionIds = order.slice(1).map((n) => n.id);
      expect(actionIds).toContain('action-1');
      expect(actionIds).toContain('action-2');
    });
  });

  describe('updateExecutionStatus', () => {
    it('should update execution to running status', async () => {
      await executor.updateExecutionStatus('exec-1', 'running');

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should update execution to completed with results', async () => {
      const nodeResults = { 'action-1': { executed: true, passed: true } };

      await executor.updateExecutionStatus('exec-1', 'completed', nodeResults);

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should update execution to failed with error', async () => {
      await executor.updateExecutionStatus('exec-1', 'failed', undefined, 'Test error');

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('multi-output branching', () => {
    it('should follow correct output branch based on outputIndex', async () => {
      // Workflow with AI classification routing to different actions
      const aiWorkflow: WorkflowDefinition = {
        id: 'wf-ai',
        name: 'AI Classification Workflow',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            nodeType: 'email_received',
            name: 'Email Received',
            position: [0, 0],
            parameters: {},
          },
          {
            id: 'ai-1',
            type: 'condition',
            nodeType: 'ai_classification',
            name: 'Classify Email',
            position: [100, 0],
            parameters: { categories: ['promotional', 'newsletter', 'important'] },
          },
          {
            id: 'action-promo',
            type: 'action',
            nodeType: 'mark_read',
            name: 'Mark Promo Read',
            position: [200, 0],
            parameters: {},
          },
          {
            id: 'action-newsletter',
            type: 'action',
            nodeType: 'archive',
            name: 'Archive Newsletter',
            position: [200, 100],
            parameters: {},
          },
          {
            id: 'action-important',
            type: 'action',
            nodeType: 'add_label',
            name: 'Add Important Label',
            position: [200, 200],
            parameters: { label: 'Important' },
          },
        ],
        connections: {
          'trigger-1': { main: [[{ node: 'ai-1', index: 0 }]] },
          'ai-1': {
            main: [
              [{ node: 'action-promo', index: 0 }],      // output 0: promotional
              [{ node: 'action-newsletter', index: 0 }], // output 1: newsletter
              [{ node: 'action-important', index: 0 }],  // output 2: important
            ],
          },
        },
      };

      // AI mock returns 'promotional' so outputIndex will be 0
      mockDb.query.workflowExecution.findFirst.mockResolvedValue({
        ...sampleExecution,
        workflowId: 'wf-ai',
      });
      mockDb.query.workflow.findFirst.mockResolvedValue(aiWorkflow);

      const result = await executor.execute('exec-1');

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      // The promotional action (mark_read) should be executed
      expect(mockModifyThread).toHaveBeenCalledWith('thread-456', {
        addLabels: [],
        removeLabels: ['UNREAD'],
      });
    });

    it('should handle workflow with parallel actions on same output', async () => {
      const parallelWorkflow: WorkflowDefinition = {
        id: 'wf-parallel',
        name: 'Parallel Actions Workflow',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            nodeType: 'email_received',
            name: 'Trigger',
            position: [0, 0],
            parameters: {},
          },
          {
            id: 'action-1',
            type: 'action',
            nodeType: 'mark_read',
            name: 'Mark Read',
            position: [100, 0],
            parameters: {},
          },
          {
            id: 'action-2',
            type: 'action',
            nodeType: 'archive',
            name: 'Archive',
            position: [100, 100],
            parameters: {},
          },
        ],
        connections: {
          'trigger-1': {
            main: [[{ node: 'action-1', index: 0 }, { node: 'action-2', index: 0 }]],
          },
        },
      };

      mockDb.query.workflowExecution.findFirst.mockResolvedValue({
        ...sampleExecution,
        workflowId: 'wf-parallel',
      });
      mockDb.query.workflow.findFirst.mockResolvedValue(parallelWorkflow);

      const result = await executor.execute('exec-1');

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      // Both actions should be executed
      expect(mockModifyThread).toHaveBeenCalledTimes(2);
    });
  });
});
