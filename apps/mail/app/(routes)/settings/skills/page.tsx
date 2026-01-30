'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSkills, useSkillMutations, type Skill } from '@/hooks/use-skills';
import { SettingsCard } from '@/components/settings/settings-card';
import { SkillDialog } from '@/components/skills/skill-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Bin } from '@/components/icons/icons';
import { Plus, Pencil } from 'lucide-react';
import { m } from '@/paraglide/messages';
import { useState } from 'react';
import { toast } from 'sonner';

export default function SkillsPage() {
  const { data, isLoading, error, refetch } = useSkills();
  const { createSkill, updateSkill, deleteSkill, toggleSkill } = useSkillMutations();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);

  const skills = data?.skills ?? [];

  const handleSubmit = async (formData: {
    name: string;
    description: string;
    content: string;
  }) => {
    await toast.promise(
      editingSkill
        ? updateSkill.mutateAsync({
            id: editingSkill.id,
            name: formData.name,
            description: formData.description || undefined,
            content: formData.content,
          })
        : createSkill.mutateAsync({
            name: formData.name,
            description: formData.description || undefined,
            content: formData.content,
          }),
      {
        loading: m['pages.settings.skills.savingSkill'](),
        success: m['pages.settings.skills.saveSkillSuccess'](),
        error: m['pages.settings.skills.failedToSaveSkill'](),
      },
    );
  };

  const handleDelete = async (id: string) => {
    toast.promise(deleteSkill.mutateAsync({ id }), {
      loading: m['pages.settings.skills.deletingSkill'](),
      success: m['pages.settings.skills.deleteSkillSuccess'](),
      error: m['pages.settings.skills.failedToDeleteSkill'](),
      finally: async () => {
        await refetch();
      },
    });
  };

  const handleToggle = async (id: string, isEnabled: boolean) => {
    await toggleSkill.mutateAsync({ id, isEnabled });
    await refetch();
  };

  const handleEdit = (skill: Skill) => {
    setEditingSkill(skill);
    setIsDialogOpen(true);
  };

  return (
    <div className="grid gap-6">
      <SettingsCard
        title={m['pages.settings.skills.title']()}
        description={m['pages.settings.skills.description']()}
        action={
          <SkillDialog
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {m['pages.settings.skills.createSkill']()}
              </Button>
            }
            editingSkill={editingSkill}
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) setEditingSkill(null);
            }}
            onSubmit={handleSubmit}
            onSuccess={refetch}
          />
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
              ) : skills.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-muted-foreground text-sm">
                    {m['pages.settings.skills.noSkills']()}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {m['pages.settings.skills.noSkillsHint']()}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {skills.map((skill) => (
                    <div
                      key={skill.id}
                      className="hover:bg-muted/50 group relative flex items-center justify-between rounded-lg border p-4 transition-colors"
                    >
                      <div className="flex flex-1 items-start gap-4">
                        <Switch
                          checked={skill.isEnabled}
                          onCheckedChange={(checked) => handleToggle(skill.id, checked)}
                        />
                        <div className="flex-1 space-y-1">
                          <span className="font-medium">{skill.name}</span>
                          {skill.description && (
                            <p className="text-muted-foreground text-sm">{skill.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 [&_svg]:size-4"
                              onClick={() => handleEdit(skill)}
                            >
                              <Pencil className="text-[#898989]" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="dark:bg-panelDark mb-1 bg-white">
                            {m['pages.settings.skills.editSkill']()}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-[#FDE4E9] dark:hover:bg-[#411D23] [&_svg]:size-4"
                              onClick={() => handleDelete(skill.id)}
                            >
                              <Bin className="fill-[#F43F5E]" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="dark:bg-panelDark mb-1 bg-white">
                            {m['pages.settings.skills.deleteSkill']()}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </SettingsCard>
    </div>
  );
}
