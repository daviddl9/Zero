'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useThreads, useThread } from '@/hooks/use-threads';
import {
  useWorkflowMutations,
  type WorkflowNode,
  type WorkflowConnections,
  type TestWorkflowResult,
} from '@/hooks/use-workflows';
import { m } from '@/paraglide/messages';
import { Play, Search, Mail, CheckCircle, XCircle, Circle, Loader2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';

interface TestWorkflowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId?: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnections;
  onTestComplete: (result: TestWorkflowResult) => void;
}

function ThreadListItem({
  threadId,
  isSelected,
  onSelect,
}: {
  threadId: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { data: threadData } = useThread(threadId);
  const latestMessage = threadData?.latest;

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left p-3 rounded-md transition-colors',
        'hover:bg-muted/50',
        isSelected && 'bg-primary/10 border border-primary/30',
      )}
    >
      <p className="text-sm font-medium truncate">
        {latestMessage?.subject || '(No subject)'}
      </p>
      <p className="text-xs text-muted-foreground truncate">
        {latestMessage?.sender?.name || latestMessage?.sender?.email || 'Unknown sender'}
      </p>
      {latestMessage?.receivedOn && (
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(latestMessage.receivedOn), { addSuffix: true })}
        </p>
      )}
    </button>
  );
}

function SelectedThreadPreview({ threadId }: { threadId: string }) {
  const { data: threadData, isLoading } = useThread(threadId);
  const latestMessage = threadData?.latest;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!latestMessage) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Mail className="h-8 w-8 mb-2" />
        <p className="text-sm">Could not load email</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      <div>
        <p className="text-xs text-muted-foreground">Subject</p>
        <p className="text-sm font-medium">{latestMessage.subject || '(No subject)'}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">From</p>
        <p className="text-sm">
          {latestMessage.sender?.name
            ? `${latestMessage.sender.name} <${latestMessage.sender.email}>`
            : latestMessage.sender?.email}
        </p>
      </div>
      {latestMessage.receivedOn && (
        <div>
          <p className="text-xs text-muted-foreground">Received</p>
          <p className="text-sm">{new Date(latestMessage.receivedOn).toLocaleString()}</p>
        </div>
      )}
      {latestMessage.body && (
        <div>
          <p className="text-xs text-muted-foreground">Preview</p>
          <p className="text-sm text-muted-foreground line-clamp-3">{latestMessage.body}</p>
        </div>
      )}
    </div>
  );
}

export function TestWorkflowModal({
  open,
  onOpenChange,
  workflowId,
  nodes,
  connections,
  onTestComplete,
}: TestWorkflowModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestWorkflowResult | null>(null);

  const [threadsQuery, threads] = useThreads();
  const { testWorkflow } = useWorkflowMutations();

  // Get thread IDs for display (limited to 20)
  const displayThreadIds = useMemo(() => {
    return threads.slice(0, 20).map((t) => t.id);
  }, [threads]);

  const handleRunTest = async () => {
    if (!selectedThreadId) return;

    setTestResult(null);

    try {
      const result = await testWorkflow.mutateAsync({
        workflowId,
        threadId: selectedThreadId,
        nodes,
        connections,
      });

      setTestResult(result);
      onTestComplete(result);
    } catch (error) {
      setTestResult({
        success: false,
        nodeResults: {},
        executionPath: [],
        error: error instanceof Error ? error.message : 'Test failed',
      });
    }
  };

  const handleClose = () => {
    setTestResult(null);
    setSelectedThreadId(null);
    setSearchQuery('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent showOverlay className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{m['pages.settings.workflows.testWorkflow']()}</DialogTitle>
          <DialogDescription>
            {m['pages.settings.workflows.testWorkflowDescription']()}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          {/* Left panel: Email selector */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={m['pages.settings.workflows.selectEmail']()}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-[300px] rounded-md border">
              {threadsQuery.isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : displayThreadIds.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Mail className="h-8 w-8 mb-2" />
                  <p className="text-sm">No emails found</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {displayThreadIds.map((threadId) => (
                    <ThreadListItem
                      key={threadId}
                      threadId={threadId}
                      isSelected={selectedThreadId === threadId}
                      onSelect={() => setSelectedThreadId(threadId)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right panel: Results or preview */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">
              {testResult ? m['pages.settings.workflows.testResults']() : 'Selected Email'}
            </h3>

            <ScrollArea className="h-[300px] rounded-md border">
              {testResult ? (
                <div className="p-3 space-y-3">
                  {/* Overall status */}
                  <div
                    className={cn(
                      'p-3 rounded-md',
                      testResult.success
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {testResult.success ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="text-sm font-medium">
                        {testResult.success ? 'Test passed' : 'Test failed'}
                      </span>
                    </div>
                    {testResult.error && (
                      <p className="text-xs text-red-600 mt-1">{testResult.error}</p>
                    )}
                  </div>

                  {/* Node-by-node results */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase">
                      Node Results
                    </h4>
                    {nodes.map((node) => {
                      const result = testResult.nodeResults[node.id];
                      const executed = result?.executed;
                      const passed = result?.passed;

                      return (
                        <div
                          key={node.id}
                          className={cn(
                            'p-2 rounded-md text-sm flex items-center gap-2',
                            !executed && 'opacity-50',
                            executed && passed && 'bg-emerald-50 dark:bg-emerald-950/20',
                            executed && !passed && 'bg-red-50 dark:bg-red-950/20',
                          )}
                        >
                          {!executed ? (
                            <Circle className="h-4 w-4 text-muted-foreground" />
                          ) : passed ? (
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="flex-1 truncate">{node.name}</span>
                          {result?.category && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs text-emerald-600 dark:text-emerald-400 cursor-help">
                                    {result.category}
                                  </span>
                                </TooltipTrigger>
                                {result?.reasoning && (
                                  <TooltipContent side="top" className="max-w-xs">
                                    <p className="text-xs">{result.reasoning}</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Execution path */}
                  {testResult.executionPath.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase">
                        Execution Path
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {testResult.executionPath
                          .map((id) => nodes.find((n) => n.id === id)?.name || id)
                          .join(' → ')}
                      </p>
                    </div>
                  )}
                </div>
              ) : selectedThreadId ? (
                <SelectedThreadPreview threadId={selectedThreadId} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Mail className="h-8 w-8 mb-2" />
                  <p className="text-sm">{m['pages.settings.workflows.selectEmail']()}</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {m['common.actions.close']()}
          </Button>
          <Button onClick={handleRunTest} disabled={!selectedThreadId || testWorkflow.isPending}>
            {testWorkflow.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {m['pages.settings.workflows.runTest']()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
