'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Zap,
  AlertTriangle,
  Gauge,
  Copy,
  Brain,
  Filter,
  ArrowUpDown,
  type LucideIcon,
} from 'lucide-react';

// ============================================================================
// Type Definitions
// ============================================================================

type SuggestionType =
  | 'node_optimization'
  | 'missing_error_handling'
  | 'performance'
  | 'redundancy'
  | 'ai_classification_tuning'
  | 'missing_condition'
  | 'action_sequencing';

type Priority = 'low' | 'medium' | 'high';

interface ProposedFix {
  addNodes?: Array<{
    id: string;
    type: 'trigger' | 'condition' | 'action';
    nodeType: string;
    name: string;
    position: [number, number];
    parameters: Record<string, unknown>;
    disabled?: boolean;
  }>;
  removeNodeIds?: string[];
  updateConnections?: Record<
    string,
    {
      main: Array<Array<{ node: string; index: number }>>;
    }
  >;
}

interface WorkflowSuggestion {
  type: SuggestionType;
  title: string;
  description: string;
  affectedNodeIds: string[];
  confidence: number;
  priority: Priority;
  proposedFix?: ProposedFix;
}

export interface SuggestionCardProps {
  suggestion: WorkflowSuggestion;
  onHover: (nodeIds: string[]) => void;
  onLeave: () => void;
  onApply: () => void;
}

// ============================================================================
// Icon and Color Mappings
// ============================================================================

const typeIcons: Record<SuggestionType, LucideIcon> = {
  node_optimization: Zap,
  missing_error_handling: AlertTriangle,
  performance: Gauge,
  redundancy: Copy,
  ai_classification_tuning: Brain,
  missing_condition: Filter,
  action_sequencing: ArrowUpDown,
};

const typeLabels: Record<SuggestionType, string> = {
  node_optimization: 'Optimization',
  missing_error_handling: 'Error Handling',
  performance: 'Performance',
  redundancy: 'Redundancy',
  ai_classification_tuning: 'AI Tuning',
  missing_condition: 'Missing Condition',
  action_sequencing: 'Sequencing',
};

const priorityColors: Record<Priority, string> = {
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const typeColors: Record<SuggestionType, string> = {
  node_optimization: 'text-blue-600 dark:text-blue-400',
  missing_error_handling: 'text-amber-600 dark:text-amber-400',
  performance: 'text-purple-600 dark:text-purple-400',
  redundancy: 'text-orange-600 dark:text-orange-400',
  ai_classification_tuning: 'text-pink-600 dark:text-pink-400',
  missing_condition: 'text-teal-600 dark:text-teal-400',
  action_sequencing: 'text-indigo-600 dark:text-indigo-400',
};

// ============================================================================
// SuggestionCard Component
// ============================================================================

export function SuggestionCard({
  suggestion,
  onHover,
  onLeave,
  onApply,
}: SuggestionCardProps) {
  const Icon = typeIcons[suggestion.type];
  const iconColor = typeColors[suggestion.type];
  const priorityColor = priorityColors[suggestion.priority];
  const typeLabel = typeLabels[suggestion.type];
  const confidencePercent = Math.round(suggestion.confidence * 100);
  const hasProposedFix = suggestion.proposedFix !== undefined;

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
      onMouseEnter={() => onHover(suggestion.affectedNodeIds)}
      onMouseLeave={onLeave}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header: Icon, Title, Badges */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex-shrink-0 rounded-md p-2 bg-muted',
              iconColor
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-medium leading-tight">
                {suggestion.title}
              </h4>
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge variant="outline" className="text-xs py-0 h-5">
                {typeLabel}
              </Badge>
              <Badge className={cn('text-xs py-0 h-5 border-0', priorityColor)}>
                {suggestion.priority}
              </Badge>
              <Badge variant="secondary" className="text-xs py-0 h-5">
                {confidencePercent}% confident
              </Badge>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground">{suggestion.description}</p>

        {/* Affected Nodes */}
        {suggestion.affectedNodeIds.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground">Affects:</span>
            {suggestion.affectedNodeIds.map((nodeId) => (
              <Badge
                key={nodeId}
                variant="outline"
                className="text-xs py-0 h-5 font-mono"
              >
                {nodeId}
              </Badge>
            ))}
          </div>
        )}

        {/* Apply Fix Button */}
        {hasProposedFix && (
          <Button
            variant="default"
            size="sm"
            className="w-full mt-2"
            onClick={(e) => {
              e.stopPropagation();
              onApply();
            }}
          >
            Apply Fix
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
