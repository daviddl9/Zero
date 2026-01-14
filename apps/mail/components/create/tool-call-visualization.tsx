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
  const hasDetails = toolCall.args || toolCall.result;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
        <CollapsibleTrigger
          disabled={!hasDetails}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors',
            hasDetails && 'hover:bg-gray-100 dark:hover:bg-gray-800',
            !hasDetails && 'cursor-default',
          )}
        >
          {hasDetails &&
            (isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
            ))}
          <Wrench className="h-3.5 w-3.5 text-gray-500" />
          <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            {formatToolName(toolCall.toolName)}
          </span>
          <ToolStatusIcon state={toolCall.state} />
        </CollapsibleTrigger>

        {hasDetails && (
          <CollapsibleContent>
            <div className="space-y-2 border-t border-gray-200 px-3 pb-3 pt-2 dark:border-gray-700">
              {toolCall.args && Object.keys(toolCall.args).length > 0 && (
                <div>
                  <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                    Arguments
                  </span>
                  <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-gray-100 p-2 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                    {formatJson(toolCall.args)}
                  </pre>
                </div>
              )}
              {toolCall.result !== undefined && (
                <div>
                  <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                    Result
                  </span>
                  <pre
                    className={cn(
                      'max-h-48 overflow-auto whitespace-pre-wrap break-words rounded p-2 text-xs',
                      toolCall.state === 'error'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
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
  const [isOpen, setIsOpen] = useState(false);

  if (toolCalls.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          'mb-3 overflow-hidden rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800/50 dark:bg-blue-900/20',
          className,
        )}
      >
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-blue-100/50 dark:hover:bg-blue-900/30">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          )}
          <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="flex-1 text-sm font-medium text-blue-700 dark:text-blue-300">
            Tool Calls
          </span>
          <span className="rounded-full bg-blue-200 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-800 dark:text-blue-300">
            {toolCalls.length}
          </span>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-2 px-3 pb-3">
            {toolCalls.map((toolCall, index) => (
              <ToolCallCard key={`${toolCall.toolName}-${index}`} toolCall={toolCall} />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
