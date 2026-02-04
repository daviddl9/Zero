'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useAnalyzeExecutions,
  useWorkflowExecutions,
  type WorkflowExecution,
} from '@/hooks/use-workflows';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  Tag,
  PieChart,
} from 'lucide-react';
import { SuggestionCard } from './suggestion-card';

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

interface CategoryDistribution {
  category: string;
  count: number;
  percentage: number;
}

interface LabelApplied {
  label: string;
  count: number;
  percentage: number;
}

interface LabellingStats {
  totalClassified: number;
  categoryDistribution: CategoryDistribution[];
  labelsApplied: LabelApplied[];
  otherCategoryCount: number;
  otherCategoryPercentage: number;
}

interface MissedLabelCandidate {
  threadId: string;
  subject?: string;
  sender?: string;
  category: string;
  reasoning: string;
  suggestedLabel: string;
  matchesPattern?: string;
  confidence: number;
}

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

export interface WorkflowSuggestion {
  type: SuggestionType;
  title: string;
  description: string;
  affectedNodeIds: string[];
  confidence: number;
  priority: Priority;
  proposedFix?: ProposedFix;
}

interface ExecutionStats {
  totalExecutions: number;
  successRate: number;
  averageDuration?: number;
  commonFailureNodes: string[];
}

interface AnalysisResult {
  suggestions: WorkflowSuggestion[];
  executionStats: ExecutionStats;
  analyzedExecutionIds: string[];
  labellingStats?: LabellingStats;
  missedLabelCandidates?: MissedLabelCandidate[];
}

export interface ExecutionAnalysisProps {
  workflowId: string;
  onHighlightNodes: (nodeIds: string[]) => void;
  onApplySuggestion: (suggestion: WorkflowSuggestion) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatPercentage(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

// ============================================================================
// Stats Card Component
// ============================================================================

interface StatsCardProps {
  stats: ExecutionStats | null;
  isLoading: boolean;
}

function StatsCard({ stats, isLoading }: StatsCardProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats || stats.totalExecutions === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No execution data available yet.
      </div>
    );
  }

  const successRateColor =
    stats.successRate >= 0.9
      ? 'text-emerald-600 dark:text-emerald-400'
      : stats.successRate >= 0.7
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Total Executions */}
      <div className="flex items-center gap-2 rounded-lg border p-3">
        <div className="rounded-md bg-blue-100 p-2 dark:bg-blue-900/30">
          <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Executions</p>
          <p className="text-lg font-semibold">{stats.totalExecutions}</p>
        </div>
      </div>

      {/* Success Rate */}
      <div className="flex items-center gap-2 rounded-lg border p-3">
        <div
          className={cn(
            'rounded-md p-2',
            stats.successRate >= 0.9
              ? 'bg-emerald-100 dark:bg-emerald-900/30'
              : stats.successRate >= 0.7
                ? 'bg-amber-100 dark:bg-amber-900/30'
                : 'bg-red-100 dark:bg-red-900/30',
          )}
        >
          {stats.successRate >= 0.9 ? (
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : stats.successRate >= 0.7 ? (
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Success Rate</p>
          <p className={cn('text-lg font-semibold', successRateColor)}>
            {formatPercentage(stats.successRate)}
          </p>
        </div>
      </div>

      {/* Average Duration */}
      {stats.averageDuration !== undefined && (
        <div className="flex items-center gap-2 rounded-lg border p-3">
          <div className="rounded-md bg-purple-100 p-2 dark:bg-purple-900/30">
            <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg Duration</p>
            <p className="text-lg font-semibold">{formatDuration(stats.averageDuration)}</p>
          </div>
        </div>
      )}

      {/* Common Failure Nodes */}
      {stats.commonFailureNodes.length > 0 && (
        <div className="col-span-2 rounded-lg border p-3">
          <p className="text-xs text-muted-foreground mb-2">Common Failure Nodes</p>
          <div className="flex flex-wrap gap-1.5">
            {stats.commonFailureNodes.map((nodeId) => (
              <Badge
                key={nodeId}
                variant="outline"
                className="text-xs py-0 h-5 font-mono bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
              >
                {nodeId}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Labelling Insights Section Component
// ============================================================================

interface LabellingInsightsSectionProps {
  labellingStats: LabellingStats;
  missedLabelCandidates?: MissedLabelCandidate[];
}

function LabellingInsightsSection({
  labellingStats,
  missedLabelCandidates,
}: LabellingInsightsSectionProps) {
  const highOtherRate = labellingStats.otherCategoryPercentage > 30;
  const maxCategoryCount = Math.max(...labellingStats.categoryDistribution.map((c) => c.count), 1);

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-emerald-100 p-1.5 dark:bg-emerald-900/30">
          <PieChart className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h4 className="text-sm font-medium">Labelling Insights</h4>
        <Badge variant="secondary" className="text-xs">
          {labellingStats.totalClassified} classified
        </Badge>
      </div>

      {/* High Other Rate Warning */}
      {highOtherRate && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                High "other" category rate
              </p>
              <p className="text-amber-700 dark:text-amber-400 mt-1">
                {labellingStats.otherCategoryPercentage.toFixed(0)}% of emails are going to "other".
                Consider adding more categories or expanding criteria.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Category Distribution */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium">Category Distribution</p>
        <div className="space-y-2">
          {labellingStats.categoryDistribution.map((cat) => {
            const isOther = cat.category === 'other';
            const barWidth = (cat.count / maxCategoryCount) * 100;

            return (
              <div key={cat.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={cn(
                      'font-medium',
                      isOther && highOtherRate && 'text-amber-600 dark:text-amber-400',
                    )}
                  >
                    {cat.category}
                  </span>
                  <span className="text-muted-foreground">
                    {cat.count} ({cat.percentage.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      isOther
                        ? highOtherRate
                          ? 'bg-amber-500'
                          : 'bg-gray-400'
                        : 'bg-emerald-500',
                    )}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Labels Applied Summary */}
      {labellingStats.labelsApplied.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Labels Applied</p>
          <div className="flex flex-wrap gap-1.5">
            {labellingStats.labelsApplied.map((label) => (
              <Badge
                key={label.label}
                variant="outline"
                className="text-xs py-0.5 h-6 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
              >
                <Tag className="h-3 w-3 mr-1" />
                {label.label}: {label.count}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Missed Label Candidates */}
      {missedLabelCandidates && missedLabelCandidates.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">
            Potential Missed Labels ({missedLabelCandidates.length})
          </p>
          <div className="space-y-2 max-h-[150px] overflow-y-auto">
            {missedLabelCandidates.slice(0, 5).map((candidate, index) => (
              <div
                key={`${candidate.threadId}-${index}`}
                className="rounded-lg border p-2.5 text-xs space-y-1 bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium truncate flex-1">
                    {candidate.subject || '(no subject)'}
                  </p>
                  <Badge
                    variant="outline"
                    className="text-xs py-0 h-5 shrink-0 bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700"
                  >
                    → {candidate.suggestedLabel}
                  </Badge>
                </div>
                <p className="text-muted-foreground truncate">
                  From: {candidate.sender || '(unknown)'}
                </p>
                <p className="text-muted-foreground">{candidate.reasoning}</p>
              </div>
            ))}
          </div>
          {missedLabelCandidates.length > 5 && (
            <p className="text-xs text-muted-foreground text-center">
              +{missedLabelCandidates.length - 5} more candidates
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ExecutionAnalysis Component
// ============================================================================

const MINIMUM_EXECUTIONS_FOR_ANALYSIS = 5;

export function ExecutionAnalysis({
  workflowId,
  onHighlightNodes,
  onApplySuggestion,
}: ExecutionAnalysisProps) {
  // State for cached analysis results
  const [cachedAnalysis, setCachedAnalysis] = useState<AnalysisResult | null>(null);
  const [lastAnalyzedWorkflowId, setLastAnalyzedWorkflowId] = useState<string | null>(null);

  // Fetch executions to compute basic stats
  const { data: executionsData, isLoading: isLoadingExecutions } = useWorkflowExecutions(
    workflowId || '',
  );

  // Analysis mutation
  const analyzeExecutions = useAnalyzeExecutions();

  // Extract executions array from response
  const executions =
    (executionsData as { executions: WorkflowExecution[] } | undefined)?.executions ?? [];

  // Compute local stats from executions
  const localStats: ExecutionStats | null =
    executions.length > 0
      ? {
          totalExecutions: executions.length,
          successRate:
            executions.filter((e) => e.status === 'completed').length / executions.length,
          averageDuration: undefined, // Computed by AI analyzer
          commonFailureNodes: [], // Computed by AI analyzer
        }
      : null;

  // Use cached stats if available, otherwise use local stats
  const displayStats = cachedAnalysis?.executionStats ?? localStats;

  // Clear cache when workflowId changes
  useEffect(() => {
    if (workflowId !== lastAnalyzedWorkflowId) {
      setCachedAnalysis(null);
    }
  }, [workflowId, lastAnalyzedWorkflowId]);

  // Handle analyze button click
  const handleAnalyze = async () => {
    if (!workflowId) return;

    try {
      const result = await analyzeExecutions.mutateAsync({
        workflowId,
        limit: 20,
      });

      setCachedAnalysis(result as AnalysisResult);
      setLastAnalyzedWorkflowId(workflowId);
    } catch (error) {
      console.error('Failed to analyze executions:', error);
    }
  };

  // Show save message if no workflowId
  if (!workflowId) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Execution Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-6">
            Save workflow first to analyze executions.
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasEnoughExecutions = executions.length >= MINIMUM_EXECUTIONS_FOR_ANALYSIS;
  const isAnalyzing = analyzeExecutions.isPending;
  const hasSuggestions = cachedAnalysis && cachedAnalysis.suggestions.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Execution Analysis
          </CardTitle>
          {cachedAnalysis && (
            <Badge variant="secondary" className="text-xs">
              {cachedAnalysis.analyzedExecutionIds.length} analyzed
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Display */}
        <StatsCard stats={displayStats} isLoading={isLoadingExecutions} />

        {/* Labelling Insights Section */}
        {cachedAnalysis?.labellingStats && (
          <LabellingInsightsSection
            labellingStats={cachedAnalysis.labellingStats}
            missedLabelCandidates={cachedAnalysis.missedLabelCandidates}
          />
        )}

        {/* Insufficient Data Message */}
        {!isLoadingExecutions && !hasEnoughExecutions && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  Insufficient data for analysis
                </p>
                <p className="text-amber-700 dark:text-amber-400 mt-1">
                  At least {MINIMUM_EXECUTIONS_FOR_ANALYSIS} executions are needed. Current:{' '}
                  {executions.length}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Analyze Button */}
        {hasEnoughExecutions && (
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full"
            variant={cachedAnalysis ? 'outline' : 'default'}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                {cachedAnalysis ? 'Re-analyze' : 'Analyze Executions'}
              </>
            )}
          </Button>
        )}

        {/* Suggestions Section */}
        {hasSuggestions && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">
                Suggestions ({cachedAnalysis.suggestions.length})
              </h4>
            </div>
            <ScrollArea className="h-[200px]">
              <div className="space-y-3 pr-3">
                {cachedAnalysis.suggestions.map((suggestion) => (
                  <SuggestionCard
                    key={`${suggestion.type}-${suggestion.title}`}
                    suggestion={suggestion}
                    onHover={(nodeIds) => onHighlightNodes(nodeIds)}
                    onLeave={() => onHighlightNodes([])}
                    onApply={() => onApplySuggestion(suggestion)}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* No Suggestions Message */}
        {cachedAnalysis && cachedAnalysis.suggestions.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4 rounded-lg border bg-emerald-50/50 dark:bg-emerald-900/10">
            <CheckCircle className="h-5 w-5 text-emerald-500 mx-auto mb-2" />
            No issues found. Your workflow is running optimally.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
