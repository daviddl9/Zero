import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Brain, RefreshCw, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { ToolCallData } from './tool-call-visualization';

export interface ThoughtData {
  thought: string;
  thoughtNumber: number;
  totalThoughts: number;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
  branchId?: string;
  nextThoughtNeeded: boolean;
}

interface ThinkingVisualizationProps {
  thoughts?: ThoughtData[];
  thinkToolCalls?: ToolCallData[];
  isStreaming?: boolean;
  className?: string;
}

function ThoughtIcon({ thought }: { thought: ThoughtData }) {
  if (thought.isRevision) {
    return <RefreshCw className="h-3.5 w-3.5 text-amber-500" />;
  }
  if (thought.branchFromThought) {
    return <GitBranch className="h-3.5 w-3.5 text-green-500" />;
  }
  return <Brain className="h-3.5 w-3.5 text-purple-500" />;
}

function ThoughtLabel({ thought }: { thought: ThoughtData }) {
  if (thought.isRevision) {
    return (
      <span className="text-amber-600 dark:text-amber-400">
        Revision (thought {thought.revisesThought})
      </span>
    );
  }
  if (thought.branchFromThought) {
    return (
      <span className="text-green-600 dark:text-green-400">
        Branch from {thought.branchFromThought}
        {thought.branchId && ` (${thought.branchId})`}
      </span>
    );
  }
  return <span className="text-purple-600 dark:text-purple-400">Thought</span>;
}

function ThoughtCard({ thought }: { thought: ThoughtData }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 transition-all dark:border-gray-700 dark:bg-gray-800/50">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ThoughtIcon thought={thought} />
          <span className="text-xs font-medium">
            <ThoughtLabel thought={thought} />
          </span>
        </div>
        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {thought.thoughtNumber}/{thought.totalThoughts}
        </span>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        {thought.thought}
      </p>
    </div>
  );
}

function SimpleThinkCard({ toolCall }: { toolCall: ToolCallData }) {
  const thought = toolCall.args?.thought as string | undefined;
  const nextAction = toolCall.args?.nextAction as string | undefined;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 transition-all dark:border-gray-700 dark:bg-gray-800/50">
      <div className="mb-2 flex items-center gap-2">
        <Brain className="h-3.5 w-3.5 text-purple-500" />
        <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Thinking</span>
      </div>
      {thought && (
        <div className="mb-2">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {thought}
          </p>
        </div>
      )}
      {nextAction && (
        <div className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-700">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Next action:</span>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-600 dark:text-gray-400">
            {nextAction}
          </p>
        </div>
      )}
    </div>
  );
}

export function ThinkingVisualization({
  thoughts,
  thinkToolCalls,
  isStreaming = false,
  className,
}: ThinkingVisualizationProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Handle simple think tool calls
  if (thinkToolCalls && thinkToolCalls.length > 0) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div
          className={cn(
            'mb-3 overflow-hidden rounded-lg border border-purple-200 bg-purple-50/50 dark:border-purple-800/50 dark:bg-purple-900/20',
            className,
          )}
        >
          <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-purple-100/50 dark:hover:bg-purple-900/30">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            )}
            <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span className="flex-1 text-sm font-medium text-purple-700 dark:text-purple-300">
              Thinking{isStreaming ? '...' : ''}
            </span>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="space-y-2 px-3 pb-3">
              {thinkToolCalls.map((toolCall, index) => (
                <SimpleThinkCard key={`think-${index}`} toolCall={toolCall} />
              ))}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  }

  // Handle sequential thinking
  if (!thoughts || thoughts.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          'mb-3 overflow-hidden rounded-lg border border-purple-200 bg-purple-50/50 dark:border-purple-800/50 dark:bg-purple-900/20',
          className,
        )}
      >
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-purple-100/50 dark:hover:bg-purple-900/30">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          )}
          <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <span className="flex-1 text-sm font-medium text-purple-700 dark:text-purple-300">
            Thinking{isStreaming ? '...' : ''}
          </span>
          <span className="rounded-full bg-purple-200 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-800 dark:text-purple-300">
            {thoughts.length} step{thoughts.length > 1 ? 's' : ''}
          </span>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-2 px-3 pb-3">
            {thoughts.map((thought, index) => (
              <ThoughtCard key={`${thought.thoughtNumber}-${index}`} thought={thought} />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
