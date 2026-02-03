'use client';

import { useState } from 'react';
import {
  useWorkflowExecutions,
  useWorkflow,
  type WorkflowExecution,
  type WorkflowNode,
} from '@/hooks/use-workflows';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ExecutionHistoryProps {
  workflowId: string;
}

interface NodeResult {
  executed: boolean;
  passed: boolean;
  error?: string;
  outputIndex?: number;
  category?: string;
  reasoning?: string;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function formatNodeType(nodeType: string): string {
  return nodeType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/^Ai /, 'AI ');
}

function getNodeDisplayName(nodeId: string, nodes: WorkflowNode[]): string {
  const node = nodes.find((n) => n.id === nodeId);
  if (node) {
    return node.name || formatNodeType(node.nodeType);
  }
  // Fallback: parse prefix from ID
  if (nodeId.startsWith('trigger-')) return 'Trigger';
  if (nodeId.startsWith('condition-')) return 'Condition';
  if (nodeId.startsWith('action-')) return 'Action';
  return nodeId;
}

function getStatusIcon(status: WorkflowExecution['status']) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'running':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'pending':
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

function getStatusBadge(status: WorkflowExecution['status']) {
  const variants: Record<string, { className: string; label: string }> = {
    completed: {
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      label: 'Completed',
    },
    failed: {
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      label: 'Failed',
    },
    running: {
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      label: 'Running',
    },
    pending: {
      className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
      label: 'Pending',
    },
  };

  const variant = variants[status] || variants.pending;

  return (
    <Badge variant="secondary" className={cn('text-xs', variant.className)}>
      {variant.label}
    </Badge>
  );
}

function ExecutionItem({
  execution,
  nodes,
}: {
  execution: WorkflowExecution;
  nodes: WorkflowNode[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerData = execution.triggerData as Record<string, unknown> | null;
  const nodeResults = execution.nodeResults as Record<string, NodeResult> | null;

  // Handle both TriggerData (flat) and TriggerContext (nested) formats
  const thread = triggerData?.thread as Record<string, unknown> | undefined;
  const subject = (triggerData?.subject || thread?.subject) as string | undefined;
  const senderObj = thread?.sender as { email?: string; name?: string } | undefined;
  const sender = (triggerData?.sender || senderObj?.email || senderObj?.name) as string | undefined;
  const snippet = (triggerData?.snippet || thread?.body) as string | undefined;
  const event = triggerData?.event as string | undefined;

  // Generate appropriate title
  const getExecutionTitle = () => {
    if (subject) return subject;
    if (event === 'email_received') return 'Email Received';
    if (event === 'email_labeled') return 'Label Changed';
    if (event === 'schedule') return 'Scheduled Run';
    return 'Manual execution';
  };

  const hasEmailPreview = subject || sender || snippet;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start px-3 py-2 h-auto hover:bg-muted/50',
            isOpen && 'bg-muted/50',
          )}
        >
          <div className="flex items-center gap-3 w-full">
            {getStatusIcon(execution.status)}
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{getExecutionTitle()}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {hasEmailPreview ? (
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-foreground cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Mail className="h-3 w-3" />
                        <span className="truncate max-w-[150px]">{sender || 'Unknown sender'}</span>
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80" align="start">
                      <div className="space-y-2">
                        <p className="font-medium text-sm line-clamp-2">{subject || 'No subject'}</p>
                        {sender && <p className="text-xs text-muted-foreground">{sender}</p>}
                        {snippet && (
                          <p className="text-xs text-muted-foreground border-t pt-2 mt-2 line-clamp-3">
                            {snippet}
                          </p>
                        )}
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                ) : null}
                {hasEmailPreview && <span>·</span>}
                <span>{formatRelativeTime(execution.startedAt)}</span>
              </div>
            </div>
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 py-2 ml-7 space-y-2 border-l-2 border-muted">
          <div className="flex items-center gap-2">
            {getStatusBadge(execution.status)}
            {execution.completedAt && (
              <span className="text-xs text-muted-foreground">
                Completed {formatRelativeTime(execution.completedAt)}
              </span>
            )}
          </div>

          {execution.error && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">
              {execution.error}
            </div>
          )}

          {nodeResults && Object.keys(nodeResults).length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Node Results:</span>
              <div className="space-y-1">
                {Object.entries(nodeResults).map(([nodeId, result]) => (
                  <div key={nodeId} className="flex items-center gap-2 text-xs">
                    {result.executed ? (
                      result.passed ? (
                        <CheckCircle className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )
                    ) : (
                      <Clock className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="truncate">{getNodeDisplayName(nodeId, nodes)}</span>
                    {result.category && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-[10px] px-1 py-0 cursor-help">
                              {result.category}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs">{result.reasoning || 'No reasoning available'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {result.error && (
                      <span className="text-red-500 truncate">{result.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ExecutionHistory({ workflowId }: ExecutionHistoryProps) {
  const { data, isLoading, error } = useWorkflowExecutions(workflowId);
  const { data: workflowData } = useWorkflow(workflowId);

  const nodes = (workflowData as { nodes?: WorkflowNode[] } | undefined)?.nodes ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500 text-center py-4">
        {m['pages.settings.workflows.history.errorLoading']?.() || 'Failed to load execution history'}
      </div>
    );
  }

  const executions = (data as { executions: WorkflowExecution[] } | undefined)?.executions ?? [];

  if (executions.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        {m['pages.settings.workflows.history.noExecutions']?.() || 'No executions yet'}
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-1">
        {executions.map((execution) => (
          <ExecutionItem key={execution.id} execution={execution} nodes={nodes} />
        ))}
      </div>
    </ScrollArea>
  );
}
