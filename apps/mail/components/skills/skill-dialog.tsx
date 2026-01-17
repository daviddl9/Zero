'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { CurvedArrow } from '@/components/icons/icons';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useSkillReferences,
  useSkillReferenceMutations,
  type Skill,
  type SkillReference,
} from '@/hooks/use-skills';
import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { m } from '@/paraglide/messages';
import {
  Command,
  Plus,
  Pencil,
  Trash2,
  FileText,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  X,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

interface SkillFormData {
  name: string;
  description: string;
  content: string;
}

interface ReferenceFormData {
  name: string;
  content: string;
}

interface SkillDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  editingSkill?: Skill | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit: (data: SkillFormData) => Promise<void>;
}

interface ParsedSkill {
  name: string;
  description: string;
  isValid: boolean;
  error?: string;
}

const SKILL_TEMPLATE = `---
name: my-skill-name
description: Replace with description of the skill and when the AI should use it.
---

# Skill Instructions

Add your skill instructions here. This content will be available to the AI copilot when this skill is invoked.

## Guidelines

- Be specific about when this skill should be used
- Include any relevant context or reference information
- Structure the content clearly with headings and lists
`;

/**
 * Parse name and description from YAML frontmatter.
 * Format:
 *   ---
 *   name: My Skill
 *   description: What it does
 *   ---
 *   Content here...
 */
function parseSkillContent(content: string): ParsedSkill {
  const trimmed = content.trim();
  if (!trimmed) {
    return { name: '', description: '', isValid: false, error: m['pages.settings.skills.errorEmptyContent']() };
  }

  // Must start with YAML frontmatter
  if (!trimmed.startsWith('---')) {
    return { name: '', description: '', isValid: false, error: m['pages.settings.skills.errorNoFrontmatter']() };
  }

  const frontmatterEnd = trimmed.indexOf('---', 3);
  if (frontmatterEnd === -1) {
    return { name: '', description: '', isValid: false, error: m['pages.settings.skills.errorInvalidFrontmatter']() };
  }

  const frontmatter = trimmed.slice(3, frontmatterEnd).trim();
  const lines = frontmatter.split('\n');

  let name = '';
  let description = '';

  for (const line of lines) {
    const nameMatch = line.match(/^name:\s*(.+)$/i);
    if (nameMatch) {
      name = nameMatch[1].trim();
    }
    const descMatch = line.match(/^description:\s*(.+)$/i);
    if (descMatch) {
      description = descMatch[1].trim();
    }
  }

  if (!name) {
    return { name: '', description: '', isValid: false, error: m['pages.settings.skills.errorNoName']() };
  }

  // Limit lengths
  name = name.slice(0, 100);
  if (description.length > 300) {
    description = description.slice(0, 297) + '...';
  }

  return { name, description, isValid: true };
}

function ExampleModal({ onClose, onUseTemplate }: { onClose: () => void; onUseTemplate: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(SKILL_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-2xl rounded-lg border bg-background shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold">{m['pages.settings.skills.exampleTitle']()}</h3>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            {m['pages.settings.skills.exampleDescription']()}
          </p>
          <div className="relative rounded-md border bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2 h-8 gap-1 text-xs"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  {m['pages.settings.skills.copied']()}
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  {m['pages.settings.skills.copyTemplate']()}
                </>
              )}
            </Button>
            <pre className="overflow-x-auto p-4 font-mono text-xs">{SKILL_TEMPLATE}</pre>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button variant="outline" onClick={onClose}>
            {m['common.actions.close']()}
          </Button>
          <Button onClick={onUseTemplate}>
            {m['pages.settings.skills.useTemplate']()}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReferenceEditor({
  skillId,
  reference,
  onClose,
}: {
  skillId: string;
  reference?: SkillReference | null;
  onClose: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addReference, updateReference } = useSkillReferenceMutations(skillId);

  const form = useForm<ReferenceFormData>({
    defaultValues: {
      name: reference?.name || '',
      content: reference?.content || '',
    },
  });

  const handleSubmit = async (data: ReferenceFormData) => {
    setIsSubmitting(true);
    try {
      if (reference) {
        await updateReference.mutateAsync({
          referenceId: reference.id,
          name: data.name,
          content: data.content,
        });
        toast.success(m['pages.settings.skills.saveReferenceSuccess']());
      } else {
        await addReference.mutateAsync({
          skillId,
          name: data.name,
          content: data.content,
        });
        toast.success(m['pages.settings.skills.saveReferenceSuccess']());
      }
      onClose();
    } catch {
      toast.error(m['pages.settings.skills.failedToSaveReference']());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
          <FormField
            control={form.control}
            name="name"
            rules={{ required: 'Name is required' }}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">
                  {m['pages.settings.skills.referenceNameLabel']()}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={m['pages.settings.skills.referenceNamePlaceholder']()}
                    className="h-8 text-sm"
                    {...field}
                    autoFocus
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="content"
            rules={{ required: 'Content is required' }}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">
                  {m['pages.settings.skills.referenceContentLabel']()}
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={m['pages.settings.skills.referenceContentPlaceholder']()}
                    className="min-h-[120px] font-mono text-xs"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              {m['common.actions.cancel']()}
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? m['pages.settings.skills.savingReference']() : m['common.actions.save']()}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

function ReferencesSection({ skillId }: { skillId: string }) {
  const { data, isLoading } = useSkillReferences(skillId);
  const { deleteReference } = useSkillReferenceMutations(skillId);
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingRef, setEditingRef] = useState<SkillReference | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const references = data?.references || [];

  const handleDelete = async (refId: string) => {
    toast.promise(deleteReference.mutateAsync({ referenceId: refId }), {
      loading: m['pages.settings.skills.deletingReference'](),
      success: m['pages.settings.skills.deleteReferenceSuccess'](),
      error: m['pages.settings.skills.failedToDeleteReference'](),
    });
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div>
          <h4 className="text-sm font-medium">{m['pages.settings.skills.references']()}</h4>
          <p className="text-xs text-muted-foreground">
            {m['pages.settings.skills.referencesDescription']()}
          </p>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : references.length === 0 && !isAddingNew ? (
            <p className="text-xs text-muted-foreground">
              {m['pages.settings.skills.noReferences']()}
            </p>
          ) : (
            <div className="space-y-2">
              {references.map((ref) =>
                editingRef?.id === ref.id ? (
                  <ReferenceEditor
                    key={ref.id}
                    skillId={skillId}
                    reference={ref}
                    onClose={() => setEditingRef(null)}
                  />
                ) : (
                  <div
                    key={ref.id}
                    className="flex items-center justify-between rounded-md border bg-background px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{ref.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setEditingRef(ref)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(ref.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}

          {isAddingNew ? (
            <ReferenceEditor skillId={skillId} onClose={() => setIsAddingNew(false)} />
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setIsAddingNew(true)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {m['pages.settings.skills.addReference']()}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function SkillDialog({
  trigger,
  onSuccess,
  editingSkill,
  open,
  onOpenChange,
  onSubmit,
}: SkillDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : isOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setIsOpen;
  const isEditing = !!editingSkill;

  const form = useForm<SkillFormData>({
    defaultValues: {
      name: '',
      description: '',
      content: '',
    },
  });

  const content = form.watch('content');
  const parsedSkill = useMemo(() => parseSkillContent(content), [content]);

  useEffect(() => {
    if (dialogOpen) {
      setShowPreview(false);
      setShowExample(false);
      if (editingSkill) {
        form.reset({
          name: editingSkill.name,
          description: editingSkill.description || '',
          content: editingSkill.content,
        });
      } else {
        form.reset({
          name: '',
          description: '',
          content: '',
        });
      }
    }
  }, [dialogOpen, editingSkill, form]);

  const handleSubmit = async (data: SkillFormData) => {
    setIsSubmitting(true);
    try {
      // For new skills, use the parsed name and description
      if (!isEditing) {
        data.name = parsedSkill.name;
        data.description = parsedSkill.description;
      }
      await onSubmit(data);
      handleClose();
      onSuccess?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setShowPreview(false);
    setShowExample(false);
    form.reset({
      name: '',
      description: '',
      content: '',
    });
  };

  const handleContinue = () => {
    if (parsedSkill.isValid) {
      setShowPreview(true);
    }
  };

  const handleBack = () => {
    setShowPreview(false);
  };

  const handleUseTemplate = () => {
    form.setValue('content', SKILL_TEMPLATE);
    setShowExample(false);
  };

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent showOverlay={true} className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing
                ? m['pages.settings.skills.editSkill']()
                : showPreview
                  ? m['pages.settings.skills.confirmSkill']()
                  : m['pages.settings.skills.createSkill']()}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? m['pages.settings.skills.editSkillDescription']()
                : showPreview
                  ? m['pages.settings.skills.confirmSkillDescription']()
                  : m['pages.settings.skills.createSkillDescription']()}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="mt-4 space-y-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (!isEditing && !showPreview) {
                    handleContinue();
                  } else {
                    form.handleSubmit(handleSubmit)();
                  }
                }
              }}
            >
              {/* Edit mode - show all fields */}
              {isEditing && (
                <>
                  <FormField
                    control={form.control}
                    name="name"
                    rules={{ required: 'Name is required' }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{m['pages.settings.skills.nameLabel']()}</FormLabel>
                        <FormControl>
                          <Input placeholder={m['pages.settings.skills.namePlaceholder']()} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{m['pages.settings.skills.descriptionLabel']()}</FormLabel>
                        <FormControl>
                          <Input placeholder={m['pages.settings.skills.descriptionPlaceholder']()} {...field} />
                        </FormControl>
                        <FormDescription>
                          {m['pages.settings.skills.descriptionHelp']()}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="content"
                    rules={{ required: 'Content is required' }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{m['pages.settings.skills.contentLabel']()}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={m['pages.settings.skills.contentPlaceholder']()}
                            className="min-h-[200px] font-mono text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {m['pages.settings.skills.contentHelp']()}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <ReferencesSection skillId={editingSkill.id} />
                </>
              )}

              {/* Create mode - Step 1: Enter content */}
              {!isEditing && !showPreview && (
                <>
                  <FormField
                    control={form.control}
                    name="content"
                    rules={{ required: 'Content is required' }}
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>{m['pages.settings.skills.contentLabel']()}</FormLabel>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs text-muted-foreground"
                            onClick={() => setShowExample(true)}
                          >
                            <HelpCircle className="h-3.5 w-3.5" />
                            {m['pages.settings.skills.viewExample']()}
                          </Button>
                        </div>
                        <FormControl>
                          <Textarea
                            placeholder={m['pages.settings.skills.contentPlaceholder']()}
                            className="min-h-[250px] font-mono text-sm"
                            autoFocus
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {m['pages.settings.skills.contentHelpCreate']()}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Live parsing preview */}
                  {content.trim() && (
                    <div
                      className={`rounded-md border p-3 ${
                        parsedSkill.isValid
                          ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
                          : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {parsedSkill.isValid ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" />
                        ) : (
                          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
                        )}
                        <div className="flex-1 space-y-1">
                          {parsedSkill.isValid ? (
                            <>
                              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                {parsedSkill.name}
                              </p>
                              {parsedSkill.description && (
                                <p className="text-xs text-green-700 dark:text-green-300">
                                  {parsedSkill.description}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-red-700 dark:text-red-300">
                              {parsedSkill.error}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Create mode - Step 2: Confirm parsed skill */}
              {!isEditing && showPreview && (
                <div className="space-y-4">
                  <div className="rounded-md border bg-muted/30 p-4">
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">
                          {m['pages.settings.skills.nameLabel']()}
                        </label>
                        <p className="mt-1 text-lg font-semibold">{parsedSkill.name}</p>
                      </div>
                      {parsedSkill.description && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">
                            {m['pages.settings.skills.descriptionLabel']()}
                          </label>
                          <p className="mt-1 text-sm text-muted-foreground">{parsedSkill.description}</p>
                        </div>
                      )}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">
                          {m['pages.settings.skills.contentLabel']()}
                        </label>
                        <div className="mt-1 max-h-[200px] overflow-y-auto rounded-md bg-background p-3">
                          <pre className="whitespace-pre-wrap font-mono text-xs">{content}</pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                {!isEditing && showPreview && (
                  <Button className="h-8 mr-auto" type="button" variant="ghost" onClick={handleBack}>
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    {m['common.actions.back']()}
                  </Button>
                )}
                <Button className="h-8" type="button" variant="outline" onClick={handleClose}>
                  {m['common.actions.cancel']()}
                </Button>
                {!isEditing && !showPreview ? (
                  <Button
                    className="h-8"
                    type="button"
                    disabled={!parsedSkill.isValid}
                    onClick={handleContinue}
                  >
                    {m['pages.settings.skills.continue']()}
                  </Button>
                ) : (
                  <Button className="h-8 [&_svg]:size-4" type="submit" disabled={isSubmitting}>
                    {isSubmitting
                      ? m['common.actions.saving']()
                      : isEditing
                        ? m['common.actions.saveChanges']()
                        : m['pages.settings.skills.createSkill']()}
                    <div className="flex h-5 items-center justify-center gap-1 rounded-sm bg-white/10 px-1 dark:bg-black/10">
                      <Command className="h-3 w-3 text-white dark:text-[#929292]" />
                      <CurvedArrow className="mt-1.5 h-3.5 w-3.5 fill-white dark:fill-[#929292]" />
                    </div>
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Example Modal */}
      {showExample && (
        <ExampleModal onClose={() => setShowExample(false)} onUseTemplate={handleUseTemplate} />
      )}
    </>
  );
}
