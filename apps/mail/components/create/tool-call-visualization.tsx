import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Wrench, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export interface ToolCallData {
  toolName: string;
  args?: Record<string, unknown>;
  result?: unknown;
  state: 'pending' | 'streaming' | 'result' | 'error';
}

interface ToolCallVisualizationProps {
  toolCalls: ToolCallData[];
  className?: string;
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatToolName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function ToolStatusIcon({ state }: { state: ToolCallData['state'] }) {
  switch (state) {
    case 'result':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
  }
}

function ToolCallCard({ toolCall }: { toolCall: ToolCallData }) {
  const [isOpen, setIsOpen] = useState(false);
  // Always allow expansion if there are args, even without result (for pending calls)
  const hasDetails = (toolCall.args && Object.keys(toolCall.args).length > 0) || toolCall.result !== undefined;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-muted/30 dark:border-gray-700 dark:bg-gray-800/50">
        <CollapsibleTrigger
          disabled={!hasDetails}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors',
            hasDetails && 'hover:bg-muted/50 dark:hover:bg-gray-800',
            !hasDetails && 'cursor-default',
          )}
        >
          {hasDetails &&
            (isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ))}
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-sm font-medium text-foreground">
            {formatToolName(toolCall.toolName)}
          </span>
          <ToolStatusIcon state={toolCall.state} />
        </CollapsibleTrigger>

        {hasDetails && (
          <CollapsibleContent>
            <div className="space-y-2 border-t border-border px-3 pb-3 pt-2">
              {toolCall.args && Object.keys(toolCall.args).length > 0 && (
                <div>
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    Arguments
                  </span>
                  <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-2 text-xs">
                    {formatJson(toolCall.args)}
                  </pre>
                </div>
              )}
              {toolCall.result !== undefined && (
                <div>
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    Result
                  </span>
                  <pre
                    className={cn(
                      'max-h-48 overflow-auto whitespace-pre-wrap break-words rounded p-2 text-xs',
                      toolCall.state === 'error'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-background',
                    )}
                  >
                    {typeof toolCall.result === 'string'
                      ? toolCall.result
                      : formatJson(toolCall.result)}
                  </pre>
                </div>
              )}
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}

export function ToolCallVisualization({ toolCalls, className }: ToolCallVisualizationProps) {
  if (toolCalls.length === 0) {
    return null;
  }

  return (
    <div className={cn('mb-3 space-y-2', className)}>
      {toolCalls.map((toolCall, index) => (
        <ToolCallCard key={`${toolCall.toolName}-${index}`} toolCall={toolCall} />
      ))}
    </div>
  );
}
