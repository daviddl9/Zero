'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import {
  Mail,
  Tag,
  Clock,
  User,
  FileText,
  Tags,
  Search,
  Brain,
  CheckCircle,
  Circle,
  Archive,
  FileEdit,
  Bell,
  Zap,
  Check,
  X,
  Info,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { DiffStatus, NodeChange } from '@/lib/workflow-diff';

export type ExecutionStatus = 'passed' | 'failed' | 'skipped' | null;

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  nodeType: string;
  type: 'trigger' | 'condition' | 'action';
  parameters: Record<string, unknown>;
  disabled?: boolean;
  executionStatus?: ExecutionStatus;
  matchedCategory?: string;
  highlighted?: boolean;
  // Diff visualization
  diffStatus?: DiffStatus;
  diffChanges?: NodeChange[];
}

const nodeTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  // Triggers
  email_received: Mail,
  email_labeled: Tag,
  schedule: Clock,
  // Conditions
  sender_match: User,
  subject_match: FileText,
  label_match: Tags,
  keyword_match: Search,
  ai_classification: Brain,
  // Actions
  mark_read: CheckCircle,
  mark_unread: Circle,
  add_label: Tag,
  remove_label: Tag,
  archive: Archive,
  generate_draft: FileEdit,
  send_notification: Bell,
  run_skill: Zap,
};

const nodeTypeColors: Record<string, { bg: string; border: string; icon: string }> = {
  trigger: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  condition: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  action: {
    bg: 'bg-green-50 dark:bg-green-950/30',
    border: 'border-green-200 dark:border-green-800',
    icon: 'text-green-600 dark:text-green-400',
  },
};

/**
 * Get output ports for a node. AI classification nodes have one output per category + "other"
 */
function getOutputPorts(data: WorkflowNodeData): string[] {
  if (data.nodeType === 'ai_classification' && Array.isArray(data.parameters?.categories)) {
    const categories = data.parameters.categories as string[];
    return [...categories, 'other'];
  }
  return ['output']; // Single default output
}

// Diff status styling configuration
const diffStatusStyles: Record<
  DiffStatus,
  { border: string; ring: string; badge: string; badgeText: string; opacity: string }
> = {
  new: {
    border: 'border-emerald-500 border-dashed dark:border-emerald-400',
    ring: 'ring-2 ring-emerald-500/20 dark:ring-emerald-400/20',
    badge: 'bg-emerald-500 dark:bg-emerald-600',
    badgeText: 'NEW',
    opacity: '',
  },
  updated: {
    border: 'border-orange-500 border-dashed dark:border-orange-400',
    ring: 'ring-2 ring-orange-500/20 dark:ring-orange-400/20',
    badge: 'bg-orange-500 dark:bg-orange-600',
    badgeText: 'UPDATED',
    opacity: '',
  },
  removed: {
    border: 'border-red-500 border-dashed dark:border-red-400',
    ring: 'ring-2 ring-red-500/20 dark:ring-red-400/20',
    badge: 'bg-red-500 dark:bg-red-600',
    badgeText: 'REMOVED',
    opacity: 'opacity-60',
  },
  unchanged: {
    border: '',
    ring: '',
    badge: '',
    badgeText: '',
    opacity: '',
  },
};

function WorkflowNodeComponent({ data, selected }: { data: WorkflowNodeData; selected?: boolean }) {
  const Icon = nodeTypeIcons[data.nodeType] || Mail;
  const colors = nodeTypeColors[data.type] || nodeTypeColors.trigger;
  const outputPorts = getOutputPorts(data);
  const hasMultipleOutputs = outputPorts.length > 1;
  const { executionStatus, matchedCategory, highlighted, diffStatus, diffChanges } = data;

  // Execution status colors override default colors
  const getExecutionStyles = () => {
    if (executionStatus === 'passed') {
      return {
        border: 'border-emerald-500 dark:border-emerald-400',
        ring: 'ring-2 ring-emerald-500/30 dark:ring-emerald-400/30',
      };
    }
    if (executionStatus === 'failed') {
      return {
        border: 'border-red-500 dark:border-red-400',
        ring: 'ring-2 ring-red-500/30 dark:ring-red-400/30',
      };
    }
    return { border: '', ring: '' };
  };

  const executionStyles = getExecutionStyles();
  const currentDiffStyles = diffStatus ? diffStatusStyles[diffStatus] : null;

  // Determine border and ring styles based on priority: diff > execution > selection > default
  const getBorderStyles = () => {
    if (currentDiffStyles && diffStatus !== 'unchanged') {
      return { border: currentDiffStyles.border, ring: currentDiffStyles.ring };
    }
    if (executionStatus) {
      return executionStyles;
    }
    return { border: colors.border, ring: '' };
  };

  const borderStyles = getBorderStyles();

  return (
    <div
      className={cn(
        'relative rounded-lg border-2 px-4 py-3 shadow-sm transition-all min-w-[180px]',
        colors.bg,
        borderStyles.border,
        borderStyles.ring,
        selected && !executionStatus && !highlighted && !diffStatus && 'ring-2 ring-primary ring-offset-2',
        highlighted && !diffStatus && 'ring-2 ring-blue-500 ring-offset-2 dark:ring-blue-400',
        data.disabled && 'opacity-50',
        executionStatus === 'skipped' && 'opacity-40',
        currentDiffStyles?.opacity,
      )}
    >
      {/* Diff status badge */}
      {currentDiffStyles && diffStatus && diffStatus !== 'unchanged' && (
        <div
          className={cn(
            'absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white',
            currentDiffStyles.badge
          )}
        >
          {currentDiffStyles.badgeText}
        </div>
      )}

      {/* Info icon for updated nodes with changes tooltip */}
      {diffStatus === 'updated' && diffChanges && diffChanges.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="absolute top-1 right-1 cursor-help">
              <Info className="h-3.5 w-3.5 text-orange-500 dark:text-orange-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-[200px]">
            <div className="text-xs">
              <p className="font-medium mb-1">Changes:</p>
              <ul className="space-y-0.5">
                {diffChanges.map((change) => (
                  <li key={change.field} className="text-muted-foreground">
                    {change.field === 'parameters' ? 'Configuration' : change.field} modified
                  </li>
                ))}
              </ul>
            </div>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Execution status badge */}
      {!diffStatus && executionStatus === 'passed' && (
        <div className="absolute -top-2 -right-2 rounded-full bg-emerald-500 p-1">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}
      {!diffStatus && executionStatus === 'failed' && (
        <div className="absolute -top-2 -right-2 rounded-full bg-red-500 p-1">
          <X className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Input handle (not for triggers) */}
      {data.type !== 'trigger' && (
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-muted-foreground !w-3 !h-3 !border-2 !border-background"
        />
      )}

      <div className="flex items-center gap-3">
        <div className={cn('rounded-md p-2', colors.bg)}>
          <Icon className={cn('h-4 w-4', colors.icon)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{data.label}</p>
          <p className="text-xs text-muted-foreground capitalize">{data.type}</p>
          {/* Show matched category for AI classification */}
          {matchedCategory && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
              → {matchedCategory}
            </p>
          )}
        </div>
      </div>

      {/* Output handles - multiple for AI classification (unlabeled), single for others */}
      {hasMultipleOutputs ? (
        outputPorts.map((_, index) => {
          const leftPercent = ((index + 1) / (outputPorts.length + 1)) * 100;
          return (
            <Handle
              key={`output-${index}`}
              type="source"
              position={Position.Bottom}
              id={`output-${index}`}
              className="!bg-muted-foreground !w-3 !h-3 !border-2 !border-background"
              style={{ left: `${leftPercent}%` }}
            />
          );
        })
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          id="output-0"
          className="!bg-muted-foreground !w-3 !h-3 !border-2 !border-background"
        />
      )}
    </div>
  );
}

export const WorkflowNode = memo(WorkflowNodeComponent);
