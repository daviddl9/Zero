'use client';

import { useCallback, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { X, Sparkles, FileText, BarChart3 } from 'lucide-react';
import { useWorkflowAI, type WorkflowAIMode } from '@/hooks/use-workflow-ai';
import { WorkflowChat } from './workflow-chat';
import { ExecutionAnalysis } from './execution-analysis';
import type { WorkflowNodeData } from './workflow-node';

// ============================================================================
// Type Definitions
// ============================================================================

interface WorkflowDraftNode {
  id: string;
  type: 'trigger' | 'condition' | 'action';
  nodeType: string;
  name: string;
  position: [number, number];
  parameters: Record<string, unknown>;
  disabled?: boolean;
}

interface WorkflowDraftConnections {
  [key: string]: {
    main: Array<Array<{ node: string; index: number }>>;
  };
}

export interface WorkflowDraft {
  name: string;
  description?: string;
  nodes: WorkflowDraftNode[];
  connections: WorkflowDraftConnections;
}

export interface WorkflowAISidebarProps {
  workflowId?: string;
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  onApplyDraft: (draft: WorkflowDraft) => void;
  onHighlightNodes: (nodeIds: string[]) => void;
  labels: Array<{ id: string; name: string }>;
  skills: Array<{ id: string; name: string }>;
  onClose: () => void;
}

// ============================================================================
// WorkflowAISidebar Component
// ============================================================================

export function WorkflowAISidebar({
  workflowId,
  nodes: _nodes,
  edges: _edges,
  onApplyDraft,
  onHighlightNodes,
  labels,
  skills,
  onClose,
}: WorkflowAISidebarProps) {
  const { mode, setMode } = useWorkflowAI();

  // Track the current draft so we can apply it when the user clicks "Apply"
  const currentDraftRef = useRef<WorkflowDraft | null>(null);

  // Handle tab change
  const handleTabChange = useCallback(
    (value: string) => {
      setMode(value as WorkflowAIMode);
    },
    [setMode],
  );

  // Handle draft generated from chat - store it for later application
  const handleDraftGenerated = useCallback(
    (
      draft: WorkflowDraft,
      _explanation: string,
      _assumptions: string[],
      _questions?: string[],
    ) => {
      currentDraftRef.current = draft;
    },
    [],
  );

  // Handle applying the current draft when user clicks "Apply" in chat
  const handleApplyDraftFromChat = useCallback(() => {
    if (currentDraftRef.current) {
      onApplyDraft(currentDraftRef.current);
    }
  }, [onApplyDraft]);

  return (
    <div className="w-96 border-l bg-background flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">AI Assistant</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
          <span className="sr-only">Close sidebar</span>
        </Button>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3 shrink-0">
        <Tabs value={mode} onValueChange={handleTabChange}>
          <TabsList className="w-full">
            <TabsTrigger value="draft" className="flex-1 gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Draft
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex-1 gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Analysis
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {mode === 'draft' ? (
          <WorkflowChat
            onDraftGenerated={handleDraftGenerated}
            onApplyDraft={handleApplyDraftFromChat}
            labels={labels}
            skills={skills}
          />
        ) : (
          <div className="p-4 h-full overflow-auto">
            {workflowId ? (
              <ExecutionAnalysis
                workflowId={workflowId}
                onHighlightNodes={onHighlightNodes}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <div className="rounded-full bg-muted p-3 mb-4">
                  <BarChart3 className="h-6 w-6 text-muted-foreground" />
                </div>
                <h4 className="font-medium text-sm mb-2">Save workflow first</h4>
                <p className="text-sm text-muted-foreground max-w-[240px]">
                  Execution analysis requires a saved workflow with execution history.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
