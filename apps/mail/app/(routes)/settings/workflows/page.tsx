'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useWorkflows, useWorkflowMutations, type Workflow } from '@/hooks/use-workflows';
import { SettingsCard } from '@/components/settings/settings-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bin } from '@/components/icons/icons';
import { Plus, Pencil, GitBranch } from 'lucide-react';
import { m } from '@/paraglide/messages';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

export default function WorkflowsPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useWorkflows();
  const { deleteWorkflow, toggleWorkflow } = useWorkflowMutations();

  const workflows = data?.workflows ?? [];

  const handleDelete = async (id: string) => {
    toast.promise(deleteWorkflow.mutateAsync({ id }), {
      loading: m['pages.settings.workflows.deletingWorkflow'](),
      success: m['pages.settings.workflows.deleteWorkflowSuccess'](),
      error: m['pages.settings.workflows.failedToDeleteWorkflow'](),
      finally: async () => {
        await refetch();
      },
    });
  };

  const handleToggle = async (id: string, isEnabled: boolean) => {
    await toggleWorkflow.mutateAsync({ id, isEnabled });
    await refetch();
  };

  const handleEdit = (workflow: Workflow) => {
    navigate(`/settings/workflows/${workflow.id}`);
  };

  const handleCreate = () => {
    navigate('/settings/workflows/new');
  };

  const getNodeCounts = (workflow: Workflow) => {
    const triggers = workflow.nodes.filter((n) => n.type === 'trigger').length;
    const conditions = workflow.nodes.filter((n) => n.type === 'condition').length;
    const actions = workflow.nodes.filter((n) => n.type === 'action').length;
    return { triggers, conditions, actions, total: workflow.nodes.length };
  };

  return (
    <div className="grid gap-6">
      <SettingsCard
        title={m['pages.settings.workflows.title']()}
        description={m['pages.settings.workflows.description']()}
        action={
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {m['pages.settings.workflows.createWorkflow']()}
          </Button>
        }
      >
        <div className="space-y-6">
          <Separator />
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4">
              {isLoading && !error ? (
                <div className="flex h-32 items-center justify-center">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
                </div>
              ) : error ? (
                <p className="text-muted-foreground py-4 text-center text-sm">{error.message}</p>
              ) : workflows.length === 0 ? (
                <div className="py-8 text-center">
                  <GitBranch className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground text-sm">
                    {m['pages.settings.workflows.noWorkflows']()}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {m['pages.settings.workflows.noWorkflowsHint']()}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {workflows.map((workflow) => {
                    const counts = getNodeCounts(workflow);
                    return (
                      <div
                        key={workflow.id}
                        className="hover:bg-muted/50 group relative flex items-center justify-between rounded-lg border p-4 transition-colors"
                      >
                        <div className="flex flex-1 items-start gap-4">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Switch
                                checked={workflow.isEnabled}
                                onCheckedChange={(checked) => handleToggle(workflow.id, checked)}
                                style={{
                                  backgroundColor: workflow.isEnabled ? '#22c55e' : undefined,
                                }}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              {m['pages.settings.workflows.toggleEnabled']()}
                            </TooltipContent>
                          </Tooltip>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{workflow.name}</span>
                              <Badge
                                variant={workflow.isEnabled ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {workflow.isEnabled
                                  ? m['pages.settings.workflows.enabled']()
                                  : m['pages.settings.workflows.disabled']()}
                              </Badge>
                            </div>
                            {workflow.description && (
                              <p className="text-muted-foreground text-sm">
                                {workflow.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>
                                {counts.triggers} {m['pages.settings.workflows.triggers']()}
                              </span>
                              <span>·</span>
                              <span>
                                {counts.conditions} {m['pages.settings.workflows.conditions']()}
                              </span>
                              <span>·</span>
                              <span>
                                {counts.actions} {m['pages.settings.workflows.actions']()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 [&_svg]:size-4"
                                onClick={() => handleEdit(workflow)}
                              >
                                <Pencil className="text-[#898989]" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="dark:bg-panelDark mb-1 bg-white">
                              {m['pages.settings.workflows.editWorkflow']()}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-[#FDE4E9] dark:hover:bg-[#411D23] [&_svg]:size-4"
                                onClick={() => handleDelete(workflow.id)}
                              >
                                <Bin className="fill-[#F43F5E]" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="dark:bg-panelDark mb-1 bg-white">
                              {m['pages.settings.workflows.deleteWorkflow']()}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </SettingsCard>
    </div>
  );
}
