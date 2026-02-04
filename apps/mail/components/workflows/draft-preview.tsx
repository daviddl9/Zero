'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Workflow, CheckCircle, HelpCircle, X, Boxes, Zap } from 'lucide-react';

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

interface WorkflowDraft {
  name: string;
  description?: string;
  nodes: WorkflowDraftNode[];
  connections: WorkflowDraftConnections;
}

export interface DraftPreviewProps {
  draft: WorkflowDraft;
  explanation: string;
  assumptions: string[];
  questions?: string[];
  onApply: () => void;
  onClear: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getTriggerType(nodes: WorkflowDraftNode[]): string | null {
  const triggerNode = nodes.find((node) => node.type === 'trigger');
  return triggerNode?.nodeType ?? null;
}

function formatTriggerType(nodeType: string): string {
  // Convert snake_case to human-readable format
  return nodeType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================================================
// DraftPreview Component
// ============================================================================

export function DraftPreview({
  draft,
  explanation,
  assumptions,
  questions,
  onApply,
  onClear,
}: DraftPreviewProps) {
  const nodeCount = draft.nodes.length;
  const triggerType = getTriggerType(draft.nodes);
  const hasQuestions = questions && questions.length > 0;

  return (
    <Card className="border-primary/20 flex flex-col max-h-[60vh]">
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 rounded-md p-2 bg-primary/10 text-primary">
              <Workflow className="h-4 w-4" />
            </div>
            <CardTitle className="text-base leading-tight">{draft.name}</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 -mr-2 -mt-1"
            onClick={onClear}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Clear draft</span>
          </Button>
        </div>
        {/* Summary: Node count and trigger type - always visible */}
        <div className="flex items-center gap-2 flex-wrap mt-3">
          <Badge variant="secondary" className="text-xs py-0 h-5 gap-1">
            <Boxes className="h-3 w-3" />
            {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}
          </Badge>
          {triggerType && (
            <Badge variant="outline" className="text-xs py-0 h-5 gap-1">
              <Zap className="h-3 w-3" />
              {formatTriggerType(triggerType)}
            </Badge>
          )}
        </div>
      </CardHeader>

      {/* Scrollable content area */}
      <ScrollArea className="flex-1 min-h-0">
        <CardContent className="space-y-4 pt-0">
          {/* Description (if present) */}
          {draft.description && (
            <p className="text-sm text-muted-foreground">{draft.description}</p>
          )}

          {/* Explanation */}
          <div className="space-y-1.5">
            <h4 className="text-sm font-medium">Explanation</h4>
            <p className="text-sm text-muted-foreground">{explanation}</p>
          </div>

          {/* Assumptions */}
          {assumptions.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-sm font-medium flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-500" />
                Assumptions
              </h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {assumptions.map((assumption) => (
                  <li key={assumption} className="flex items-start gap-2">
                    <span className="text-muted-foreground/60 select-none">-</span>
                    <span>{assumption}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Questions (highlighted section) */}
          {hasQuestions && (
            <div className={cn(
              'p-3 rounded-md space-y-1.5',
              'bg-amber-50 dark:bg-amber-900/20',
              'border border-amber-200 dark:border-amber-800/50'
            )}>
              <h4 className="text-sm font-medium flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <HelpCircle className="h-3.5 w-3.5" />
                Questions
              </h4>
              <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-300">
                {questions!.map((question) => (
                  <li key={question} className="flex items-start gap-2">
                    <span className="text-amber-500/60 select-none">?</span>
                    <span>{question}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </ScrollArea>

      {/* Action Buttons - always visible at bottom */}
      <div className="shrink-0 px-6 py-4 border-t flex gap-2">
        <Button
          variant="default"
          className="flex-1"
          onClick={onApply}
        >
          Apply to Canvas
        </Button>
        <Button
          variant="ghost"
          onClick={onClear}
        >
          Clear
        </Button>
      </div>
    </Card>
  );
}
