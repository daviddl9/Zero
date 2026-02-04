'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2, Plus, Minus, RefreshCw } from 'lucide-react';
import type { DiffSummary } from '@/lib/workflow-diff';

export interface DiffPreviewBarProps {
  summary: DiffSummary;
  onApply: () => void;
  onDiscard: () => void;
  isApplying?: boolean;
}

export function DiffPreviewBar({
  summary,
  onApply,
  onDiscard,
  isApplying = false,
}: DiffPreviewBarProps) {
  const { newNodes, updatedNodes, removedNodes } = summary;
  const hasChanges = newNodes > 0 || updatedNodes > 0 || removedNodes > 0;

  if (!hasChanges) {
    return null;
  }

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background/95 backdrop-blur-sm shadow-lg px-4 py-2">
      {/* Summary badges */}
      <div className="flex items-center gap-2 text-sm">
        {newNodes > 0 && (
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800 gap-1"
          >
            <Plus className="h-3 w-3" />
            {newNodes} new
          </Badge>
        )}
        {updatedNodes > 0 && (
          <Badge
            variant="outline"
            className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800 gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            {updatedNodes} updated
          </Badge>
        )}
        {removedNodes > 0 && (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800 gap-1"
          >
            <Minus className="h-3 w-3" />
            {removedNodes} removed
          </Badge>
        )}
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Actions */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onDiscard}
        disabled={isApplying}
        className="gap-1.5"
      >
        <X className="h-4 w-4" />
        Discard
      </Button>
      <Button size="sm" onClick={onApply} disabled={isApplying} className="gap-1.5">
        {isApplying ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Applying...
          </>
        ) : (
          <>
            <Check className="h-4 w-4" />
            Apply Changes
          </>
        )}
      </Button>
    </div>
  );
}
