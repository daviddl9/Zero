'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Zap,
  AlertTriangle,
  Gauge,
  Copy,
  Brain,
  Filter,
  ArrowUpDown,
  Tag,
  Expand,
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
  | 'action_sequencing'
  | 'labelling_pattern'
  | 'missed_labels'
  | 'expand_criteria';

type Priority = 'low' | 'medium' | 'high';

// Note: proposedFix removed for Gemini API compatibility
interface WorkflowSuggestion {
  type: SuggestionType;
  title: string;
  description: string;
  affectedNodeIds: string[];
  confidence: number;
  priority: Priority;
}

export interface SuggestionCardProps {
  suggestion: WorkflowSuggestion;
  onHover: (nodeIds: string[]) => void;
  onLeave: () => void;
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
  labelling_pattern: Tag,
  missed_labels: AlertTriangle,
  expand_criteria: Expand,
};

const typeLabels: Record<SuggestionType, string> = {
  node_optimization: 'Optimization',
  missing_error_handling: 'Error Handling',
  performance: 'Performance',
  redundancy: 'Redundancy',
  ai_classification_tuning: 'AI Tuning',
  missing_condition: 'Missing Condition',
  action_sequencing: 'Sequencing',
  labelling_pattern: 'Pattern',
  missed_labels: 'Missed Labels',
  expand_criteria: 'Expand Scope',
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
  labelling_pattern: 'text-emerald-600 dark:text-emerald-400',
  missed_labels: 'text-orange-600 dark:text-orange-400',
  expand_criteria: 'text-cyan-600 dark:text-cyan-400',
};

// ============================================================================
// SuggestionCard Component
// ============================================================================

export function SuggestionCard({
  suggestion,
  onHover,
  onLeave,
}: SuggestionCardProps) {
  const Icon = typeIcons[suggestion.type];
  const iconColor = typeColors[suggestion.type];
  const priorityColor = priorityColors[suggestion.priority];
  const typeLabel = typeLabels[suggestion.type];
  const confidencePercent = Math.round(suggestion.confidence * 100);

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
      </CardContent>
    </Card>
  );
}
