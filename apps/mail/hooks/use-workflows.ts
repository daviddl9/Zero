'use client';

import { useTRPC } from '@/providers/query-provider';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'condition' | 'action';
  nodeType: string;
  name: string;
  position: [number, number];
  parameters: Record<string, unknown>;
  disabled?: boolean;
}

export interface WorkflowConnections {
  [sourceNodeId: string]: {
    main: Array<Array<{ node: string; index: number }>>;
  };
}

export interface Workflow {
  id: string;
  name: string;
  description?: string | null;
  isEnabled: boolean;
  nodes: WorkflowNode[];
  connections: WorkflowConnections;
  settings?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  threadId?: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  triggerData?: Record<string, unknown> | null;
  nodeResults?: Record<string, unknown> | null;
  error?: string | null;
  startedAt: string;
  completedAt?: string | null;
}

export function useWorkflows() {
  const trpc = useTRPC();

  return useQuery(
    trpc.workflows.list.queryOptions(void 0, {
      staleTime: 30000, // 30 seconds
    }),
  );
}

export function useWorkflow(id: string) {
  const trpc = useTRPC();

  return useQuery(
    trpc.workflows.get.queryOptions(
      { id },
      {
        enabled: !!id,
        staleTime: 30000,
      },
    ),
  );
}

export function useWorkflowExecutions(workflowId: string) {
  const trpc = useTRPC();

  return useQuery(
    trpc.workflows.executions.queryOptions(
      { workflowId },
      {
        enabled: !!workflowId,
        staleTime: 10000, // 10 seconds
      },
    ),
  );
}

export interface TestWorkflowResult {
  success: boolean;
  nodeResults: Record<string, {
    executed: boolean;
    passed: boolean;
    error?: string;
    outputIndex?: number;
    category?: string;
    reasoning?: string;
  }>;
  executionPath: string[];
  error?: string;
}

export function useWorkflowMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidateWorkflows = () => {
    queryClient.invalidateQueries({ queryKey: trpc.workflows.list.queryKey() });
  };

  const createWorkflow = useMutation(
    trpc.workflows.create.mutationOptions({
      onSuccess: invalidateWorkflows,
    }),
  );

  const updateWorkflow = useMutation(
    trpc.workflows.update.mutationOptions({
      onSuccess: invalidateWorkflows,
    }),
  );

  const deleteWorkflow = useMutation(
    trpc.workflows.delete.mutationOptions({
      onSuccess: invalidateWorkflows,
    }),
  );

  const toggleWorkflow = useMutation(
    trpc.workflows.toggle.mutationOptions({
      onSuccess: invalidateWorkflows,
    }),
  );

  const executeWorkflow = useMutation(trpc.workflows.execute.mutationOptions());

  const testWorkflow = useMutation(trpc.workflows.test.mutationOptions());

  return {
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    toggleWorkflow,
    executeWorkflow,
    testWorkflow,
  };
}
