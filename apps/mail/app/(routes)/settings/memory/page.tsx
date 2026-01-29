'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useMemories,
  useMemoryMutations,
  useMemoryAnalytics,
  type Memory,
  type MemoryCategory,
} from '@/hooks/use-memories';
import { SettingsCard } from '@/components/settings/settings-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Bin } from '@/components/icons/icons';
import { Plus, Pencil, Brain, Sparkles, MousePointerClick, Trash2, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  preference: 'Preference',
  correction: 'Correction',
  selection: 'Selection',
};

const CATEGORY_COLORS: Record<MemoryCategory, string> = {
  preference: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  correction: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  selection: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

export default function MemoryPage() {
  const { data, isLoading, error, refetch } = useMemories();
  const { data: analyticsData, isLoading: analyticsLoading } = useMemoryAnalytics();
  const { addPreference, updatePreference, deletePreference, clearAllMemories } =
    useMemoryMutations();

  const [activeTab, setActiveTab] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [newPreference, setNewPreference] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [editContent, setEditContent] = useState('');

  const memories = data?.memories ?? [];
  const analytics = analyticsData?.analytics;

  const filteredMemories =
    activeTab === 'all' ? memories : memories.filter((m) => m.category === activeTab);

  const handleAddPreference = async () => {
    if (!newPreference.trim()) return;

    await toast.promise(
      addPreference.mutateAsync({
        content: newPreference.trim(),
        recipientEmail: recipientEmail.trim() || undefined,
      }),
      {
        loading: 'Adding preference...',
        success: 'Preference added successfully',
        error: 'Failed to add preference',
      },
    );

    setNewPreference('');
    setRecipientEmail('');
    setIsAddDialogOpen(false);
    refetch();
  };

  const handleEditMemory = (memory: Memory) => {
    setEditingMemory(memory);
    setEditContent(memory.content);
    setIsEditDialogOpen(true);
  };

  const handleUpdateMemory = async () => {
    if (!editingMemory || !editContent.trim()) return;

    await toast.promise(
      updatePreference.mutateAsync({
        memoryId: editingMemory.id,
        content: editContent.trim(),
      }),
      {
        loading: 'Updating memory...',
        success: 'Memory updated successfully',
        error: 'Failed to update memory',
      },
    );

    setEditingMemory(null);
    setEditContent('');
    setIsEditDialogOpen(false);
    refetch();
  };

  const handleDeleteMemory = async (id: string) => {
    await toast.promise(deletePreference.mutateAsync({ memoryId: id }), {
      loading: 'Deleting memory...',
      success: 'Memory deleted successfully',
      error: 'Failed to delete memory',
    });
    refetch();
  };

  const handleClearAll = async () => {
    await toast.promise(clearAllMemories.mutateAsync({ confirm: true }), {
      loading: 'Clearing all memories...',
      success: 'All memories cleared',
      error: 'Failed to clear memories',
    });
    setIsClearDialogOpen(false);
    refetch();
  };

  return (
    <div className="grid gap-6">
      {/* Analytics Card */}
      <SettingsCard
        title="Writing Memory"
        description="Your AI learns from your writing patterns and preferences to personalize email drafts."
      >
        <div className="space-y-6">
          <Separator />

          {analyticsLoading ? (
            <div className="flex h-24 items-center justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
            </div>
          ) : analytics ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold">{analytics.totalMemories}</div>
                <div className="text-muted-foreground text-sm">Total Memories</div>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  <span className="text-2xl font-bold">
                    {analytics.memoriesByCategory.preference}
                  </span>
                </div>
                <div className="text-muted-foreground text-sm">Preferences</div>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Pencil className="h-4 w-4 text-amber-500" />
                  <span className="text-2xl font-bold">
                    {analytics.memoriesByCategory.correction}
                  </span>
                </div>
                <div className="text-muted-foreground text-sm">Corrections</div>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <MousePointerClick className="h-4 w-4 text-green-500" />
                  <span className="text-2xl font-bold">
                    {analytics.memoriesByCategory.selection}
                  </span>
                </div>
                <div className="text-muted-foreground text-sm">Selections</div>
              </div>
            </div>
          ) : null}
        </div>
      </SettingsCard>

      {/* Memories List Card */}
      <SettingsCard
        title="Memories"
        description="View and manage what the AI has learned about your writing preferences."
        action={
          <div className="flex gap-2">
            <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={memories.length === 0}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All
                </Button>
              </DialogTrigger>
              <DialogContent showOverlay>
                <DialogHeader>
                  <DialogTitle>Clear all memories?</DialogTitle>
                  <DialogDescription>
                    This will permanently delete all your writing preferences and learnings. The AI
                    will start fresh. This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="border-destructive/50 bg-destructive/10 mt-2 flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span>This action cannot be undone.</span>
                </div>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setIsClearDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleClearAll}>
                    Clear All
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Preference
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Preference</DialogTitle>
                  <DialogDescription>
                    Tell the AI about your writing preferences. For example: &quot;Always use a formal
                    greeting&quot; or &quot;Keep emails concise&quot;.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Preference</label>
                    <Textarea
                      placeholder="e.g., Always start emails with 'Hi' instead of 'Hello'"
                      value={newPreference}
                      onChange={(e) => setNewPreference(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Recipient Email (optional)
                    </label>
                    <Input
                      type="email"
                      placeholder="e.g., boss@company.com"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                    />
                    <p className="text-muted-foreground text-xs">
                      Leave empty for a general preference, or specify to apply only when emailing
                      this person.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddPreference} disabled={!newPreference.trim()}>
                    Add Preference
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      >
        <div className="space-y-6">
          <Separator />

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All ({memories.length})</TabsTrigger>
              <TabsTrigger value="preference">
                Preferences ({memories.filter((m) => m.category === 'preference').length})
              </TabsTrigger>
              <TabsTrigger value="correction">
                Corrections ({memories.filter((m) => m.category === 'correction').length})
              </TabsTrigger>
              <TabsTrigger value="selection">
                Selections ({memories.filter((m) => m.category === 'selection').length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {isLoading && !error ? (
                    <div className="flex h-32 items-center justify-center">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
                    </div>
                  ) : error ? (
                    <p className="text-muted-foreground py-4 text-center text-sm">{error.message}</p>
                  ) : filteredMemories.length === 0 ? (
                    <div className="py-8 text-center">
                      <Brain className="text-muted-foreground mx-auto mb-3 h-12 w-12" />
                      <p className="text-muted-foreground text-sm">No memories yet</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        The AI will learn from your corrections and preferences as you use it.
                      </p>
                    </div>
                  ) : (
                    filteredMemories.map((memory) => (
                      <div
                        key={memory.id}
                        className="hover:bg-muted/50 group relative flex items-start justify-between rounded-lg border p-4 transition-colors"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge className={CATEGORY_COLORS[memory.category]} variant="secondary">
                              {CATEGORY_LABELS[memory.category]}
                            </Badge>
                            {memory.recipientEmail && (
                              <Badge variant="outline" className="text-xs">
                                {memory.recipientEmail}
                              </Badge>
                            )}
                            {memory.recipientDomain && !memory.recipientEmail && (
                              <Badge variant="outline" className="text-xs">
                                @{memory.recipientDomain}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm">{memory.content}</p>
                          <p className="text-muted-foreground text-xs">
                            {new Date(memory.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 [&_svg]:size-4"
                                onClick={() => handleEditMemory(memory)}
                              >
                                <Pencil className="text-[#898989]" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="dark:bg-panelDark mb-1 bg-white">
                              Edit memory
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-[#FDE4E9] dark:hover:bg-[#411D23] [&_svg]:size-4"
                                onClick={() => handleDeleteMemory(memory.id)}
                              >
                                <Bin className="fill-[#F43F5E]" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="dark:bg-panelDark mb-1 bg-white">
                              Delete memory
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </SettingsCard>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Memory</DialogTitle>
            <DialogDescription>Update the content of this memory.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateMemory} disabled={!editContent.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
