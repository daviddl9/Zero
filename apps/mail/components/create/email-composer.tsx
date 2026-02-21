import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Check, Command, ListFilter, Loader, Paperclip, Plus, Type, Wand2, X as XIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TextEffect } from '@/components/motion-primitives/text-effect';
import { useCorrectionTracker, useSelectionTracker } from '@/hooks/use-correction-tracker';
import { useEmailAliases } from '@/hooks/use-email-aliases';
import { ScheduleSendPicker } from './schedule-send-picker';
import useComposeEditor from '@/hooks/use-compose-editor';
import { CurvedArrow, PencilCompose, Sparkles, X } from '../icons/icons';
import { gitHubEmojis } from '@tiptap/extension-emoji';
import { AnimatePresence, motion } from 'motion/react';
import { zodResolver } from '@hookform/resolvers/zod';

import { useTRPC } from '@/providers/query-provider';
import { useMutation } from '@tanstack/react-query';
import { useSettings } from '@/hooks/use-settings';

import { cn, formatFileSize } from '@/lib/utils';
import { serializeFiles } from '@/lib/schemas';
import { Input } from '@/components/ui/input';
import { EditorContent } from '@tiptap/react';
import { useForm } from 'react-hook-form';
import { Button } from '../ui/button';
import { useQueryState } from 'nuqs';
import { Toolbar } from './toolbar';
import pluralize from 'pluralize';
import { toast } from 'sonner';
import { z } from 'zod';

import { RecipientAutosuggest } from '@/components/ui/recipient-autosuggest';
import { ImageCompressionSettings } from './image-compression-settings';
import { DraftSelector, type Draft } from './draft-selector';
import type { ImageQuality } from '@/lib/image-compression';
import { compressImages } from '@/lib/image-compression';
import { AgentThinkingAccordion } from '../mail/ai-thinking-accordion';

const shortcodeRegex = /:([a-zA-Z0-9_+-]+):/g;
import { TemplateButton } from './template-button';

interface EmailComposerProps {
  initialTo?: string[];
  initialCc?: string[];
  initialBcc?: string[];
  initialSubject?: string;
  initialMessage?: string;
  initialAttachments?: File[];
  replyingTo?: string;
  onSendEmail: (data: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    message: string;
    attachments: File[];
    fromEmail?: string;
    scheduleAt?: string;
  }) => Promise<void>;
  onClose?: () => void;
  className?: string;
  autofocus?: boolean;
  settingsLoading?: boolean;
  editorClassName?: string;
}

const schema = z.object({
  to: z.array(z.string().email()).min(1),
  subject: z.string().min(1),
  message: z.string().min(1),
  attachments: z.array(z.any()).optional(),
  headers: z.any().optional(),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  threadId: z.string().optional(),
  fromEmail: z.string().optional(),
});

export function EmailComposer({
  initialTo = [],
  initialCc = [],
  initialBcc = [],
  initialSubject = '',
  initialMessage = '',
  initialAttachments = [],
  onSendEmail,
  onClose,
  className,
  autofocus = false,
  settingsLoading = false,
  editorClassName,
}: EmailComposerProps) {
  const { data: aliases } = useEmailAliases();
  const { data: settings } = useSettings();
  const [showCc, setShowCc] = useState(initialCc.length > 0);
  const [showBcc, setShowBcc] = useState(initialBcc.length > 0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [messageLength, setMessageLength] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [threadId] = useQueryState('threadId');
  const [isComposeOpen, setIsComposeOpen] = useQueryState('isComposeOpen');
  const [draftId, setDraftId] = useQueryState('draftId');
  const [aiGeneratedMessage, setAiGeneratedMessage] = useState<string | null>(null);
  const [generatedDrafts, setGeneratedDrafts] = useState<Draft[] | null>(null);
  const [aiIsLoading, setAiIsLoading] = useState(false);
  const [agentSteps, setAgentSteps] = useState<string[]>([]);
  const [agentIsThinking, setAgentIsThinking] = useState(false);
  const [isGeneratingSubject, setIsGeneratingSubject] = useState(false);
  const [helpMeWriteOpen, setHelpMeWriteOpen] = useState(false);
  const [helpMeWritePrompt, setHelpMeWritePrompt] = useState('');
  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);
  const [scheduleAt, setScheduleAt] = useState<string>();
  const [isScheduleValid, setIsScheduleValid] = useState<boolean>(true);
  const [showAttachmentWarning, setShowAttachmentWarning] = useState(false);
  const [originalAttachments, setOriginalAttachments] = useState<File[]>(initialAttachments);
  const [imageQuality, setImageQuality] = useState<ImageQuality>(
    settings?.settings?.imageCompression || 'medium',
  );
  const [activeReplyId] = useQueryState('activeReplyId');
  const [toggleToolbar, setToggleToolbar] = useState(false);
  const processAndSetAttachments = async (
    filesToProcess: File[],
    quality: ImageQuality,
    showToast: boolean = false,
  ) => {
    if (filesToProcess.length === 0) {
      setValue('attachments', [], { shouldDirty: true });
      return;
    }

    try {
      const compressedFiles = await compressImages(filesToProcess, {
        quality,
        maxWidth: 1920,
        maxHeight: 1080,
      });

      if (compressedFiles.length !== filesToProcess.length) {
        console.warn('Compressed files array length mismatch:', {
          original: filesToProcess.length,
          compressed: compressedFiles.length,
        });
        setValue('attachments', filesToProcess, { shouldDirty: true });
        setHasUnsavedChanges(true);
        if (showToast) {
          toast.error('Image compression failed, using original files');
        }
        return;
      }

      setValue('attachments', compressedFiles, { shouldDirty: true });
      setHasUnsavedChanges(true);

      if (showToast && quality !== 'original') {
        let totalOriginalSize = 0;
        let totalCompressedSize = 0;

        const imageFilesExist = filesToProcess.some((f) => f.type.startsWith('image/'));

        if (imageFilesExist) {
          filesToProcess.forEach((originalFile, index) => {
            if (originalFile.type.startsWith('image/') && compressedFiles[index]) {
              totalOriginalSize += originalFile.size;
              totalCompressedSize += compressedFiles[index].size;
            }
          });

          if (totalOriginalSize > totalCompressedSize) {
            const savings = (
              ((totalOriginalSize - totalCompressedSize) / totalOriginalSize) *
              100
            ).toFixed(1);
            if (parseFloat(savings) > 0.1) {
              toast.success(`Images compressed: ${savings}% smaller`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error compressing images:', error);
      setValue('attachments', filesToProcess, { shouldDirty: true });
      setHasUnsavedChanges(true);
      if (showToast) {
        toast.error('Image compression failed, using original files');
      }
    }
  };

  const attachmentKeywords = [
    'attachment',
    'attached',
    'attaching',
    'see the file',
    'see the files',
  ];

  const trpc = useTRPC();
  const { mutateAsync: agentGenerateDrafts } = useMutation(
    trpc.ai.agent.generateDrafts.mutationOptions(),
  );
  const { mutateAsync: createDraft } = useMutation(trpc.drafts.create.mutationOptions());
  const { mutateAsync: generateEmailSubject } = useMutation(
    trpc.ai.generateEmailSubject.mutationOptions(),
  );

  // Memory learning hooks
  const { trackAiDraft, submitCorrection, clearTracking } = useCorrectionTracker();
  const { trackSelection } = useSelectionTracker();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      to: initialTo,
      cc: initialCc,
      bcc: initialBcc,
      subject: initialSubject,
      message: initialMessage,
      attachments: initialAttachments,
      fromEmail:
        settings?.settings?.defaultEmailAlias ||
        aliases?.find((alias) => alias.primary)?.email ||
        aliases?.[0]?.email ||
        '',
    },
  });

  const { watch, setValue, getValues } = form;
  const toEmails = watch('to');
  const ccEmails = watch('cc');
  const bccEmails = watch('bcc');
  const subjectInput = watch('subject');
  const attachments = watch('attachments');
  const fromEmail = watch('fromEmail');

  // Update form values when initial props change (e.g., when replying/replyAll calculates recipients)
  useEffect(() => {
    if (initialTo.length > 0 || initialCc.length > 0 || initialSubject) {
      setValue('to', initialTo, { shouldDirty: false });
      setValue('cc', initialCc, { shouldDirty: false });
      setValue('subject', initialSubject, { shouldDirty: false });
    }
  }, [initialTo, initialCc, initialSubject, setValue]);

  const handleAttachment = async (newFiles: File[]) => {
    if (newFiles && newFiles.length > 0) {
      const newOriginals = [...originalAttachments, ...newFiles];
      setOriginalAttachments(newOriginals);
      await processAndSetAttachments(newOriginals, imageQuality, true);
    }
  };

  const removeAttachment = async (index: number) => {
    const newOriginals = originalAttachments.filter((_, i) => i !== index);
    setOriginalAttachments(newOriginals);
    await processAndSetAttachments(newOriginals, imageQuality);
    setHasUnsavedChanges(true);
  };

  const editor = useComposeEditor({
    initialValue: initialMessage,
    isReadOnly: isLoading,
    onLengthChange: (length) => {
      setHasUnsavedChanges(true);
      setMessageLength(length);
    },
    onModEnter: () => {
      void handleSend();
      return true;
    },
    onAttachmentsChange: async (files) => {
      await handleAttachment(files);
    },
    placeholder: 'Start your email here',
    autofocus,
  });

  // Add effect to focus editor when component mounts
  useEffect(() => {
    if (autofocus && editor) {
      const timeoutId = setTimeout(() => {
        editor.commands.focus('end');
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [editor, autofocus]);

  // Remove the TRPC query - we'll use the component's internal logic instead
  useEffect(() => {
    if (isComposeOpen === 'true' && editor) {
      editor.commands.focus();
    }
  }, [isComposeOpen, editor]);

  // Prevent browser navigation/refresh when there's unsaved content
  useEffect(() => {
    if (!editor) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasContent = editor?.getText()?.trim().length > 0;
      if (hasContent) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [editor]);

  // Perhaps add `hasUnsavedChanges` to the condition
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const hasContent = editor?.getText()?.trim().length > 0;
        if (hasContent && !draftId) {
          e.preventDefault();
          e.stopPropagation();
          setShowLeaveConfirmation(true);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [editor, draftId]);

  const proceedWithSend = async () => {
    try {
      if (isLoading || isSavingDraft) return;

      const values = getValues();

      // Validate recipient field
      if (!values.to || values.to.length === 0) {
        toast.error('Recipient is required');
        return;
      }

      if (!isScheduleValid) {
        toast.error('Please choose a valid date & time for scheduling');
        return;
      }

      setIsLoading(true);
      setAiGeneratedMessage(null);
      setGeneratedDrafts(null);

      // Submit correction to memory system if AI draft was edited
      const currentContent = editor.getText();
      const primaryRecipient = values.to[0] ?? '';
      const subjectKeywords = values.subject
        .split(/\s+/)
        .filter((word) => word.length > 3)
        .slice(0, 5);

      // Fire-and-forget - don't block sending
      submitCorrection({
        currentContent,
        recipientEmail: primaryRecipient,
        subjectKeywords,
      }).catch(() => {
        // Silently ignore errors - learning is non-critical
      });

      // Save draft before sending, we want to send drafts instead of sending new emails
      if (hasUnsavedChanges) await saveDraft();

      await onSendEmail({
        to: values.to,
        cc: showCc ? values.cc : undefined,
        bcc: showBcc ? values.bcc : undefined,
        subject: values.subject,
        message: editor.getHTML(),
        attachments: values.attachments || [],
        fromEmail: values.fromEmail,
        scheduleAt,
      });
      setHasUnsavedChanges(false);
      editor.commands.clearContent(true);
      form.reset();
      setIsComposeOpen(null);
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    const values = getValues();
    const messageText = editor.getText().toLowerCase();
    const hasAttachmentKeywords = attachmentKeywords.some((keyword) => {
      const regex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'i');
      return regex.test(messageText);
    });

    if (hasAttachmentKeywords && (!values.attachments || values.attachments.length === 0)) {
      setShowAttachmentWarning(true);
      return;
    }

    await proceedWithSend();
  };

  const handleAiGenerate = async (description?: string) => {
    try {
      setIsLoading(true);
      setAiIsLoading(true);
      setAgentIsThinking(true);
      setAgentSteps([]);
      const values = getValues();

      const result = await agentGenerateDrafts({
        recipientEmail: values.to[0] || initialTo[0],
        userPoints: description || editor.getText(),
        threadId: threadId ?? undefined,
        subject: values.subject || undefined,
      });

      if (result.steps) {
        setAgentSteps(result.steps);
      }

      // If we have multiple drafts, show the draft selector
      if (result.drafts && result.drafts.length > 1) {
        const drafts: Draft[] = result.drafts.map((draft, index) => {
          // Handle both old string format and new structured format
          if (typeof draft === 'string') {
            return {
              id: `ai-${index}`,
              body: draft,
              approach: index === 0 ? 'Response Option A' : 'Response Option B',
            };
          }
          return {
            id: `ai-${index}`,
            body: draft.body,
            approach: draft.approach || (index === 0 ? 'Response Option A' : 'Response Option B'),
            subject: draft.subject,
            to: draft.to,
            cc: draft.cc,
          };
        });
        setGeneratedDrafts(drafts);
        setAiGeneratedMessage(null);
      } else {
        // Fall back to single draft behavior
        const firstDraft = result.drafts?.[0];
        const body = typeof firstDraft === 'string' ? firstDraft : firstDraft?.body || '';
        setAiGeneratedMessage(body);
        setGeneratedDrafts(null);
      }
    } catch (error) {
      console.error('Error generating AI email:', error);
      toast.error('Failed to generate email');
    } finally {
      setIsLoading(false);
      setAiIsLoading(false);
      setAgentIsThinking(false);
    }
  };

  const handleHelpMeWrite = async () => {
    const prompt = helpMeWritePrompt.trim();
    if (!prompt) return;

    const values = getValues();
    const existingBody = editor.getText().trim();
    const existingSubject = values.subject?.trim();

    let fullPrompt = prompt;
    if (existingSubject || existingBody) {
      const contextParts: string[] = [];
      if (existingSubject) contextParts.push(`Subject: ${existingSubject}`);
      if (existingBody) contextParts.push(`Draft so far:\n${existingBody}`);
      fullPrompt = `${prompt}\n\nExisting context:\n${contextParts.join('\n')}`;
    }

    if (!subjectInput.trim()) {
      await handleGenerateSubject();
    }
    setAiGeneratedMessage(null);
    setGeneratedDrafts(null);
    setHelpMeWriteOpen(false);
    await handleAiGenerate(fullPrompt);
    setHelpMeWritePrompt('');
  };

  const handleMakeConcise = async () => {
    const text = editor.getText().trim();
    if (!text) {
      toast.error('Write an email first, then make it concise');
      return;
    }
    setAiGeneratedMessage(null);
    setGeneratedDrafts(null);
    await handleAiGenerate(
      `Rewrite this email to be more succinct and clear while keeping the same tone and key points:\n\n${text}`,
    );
  };

  const handlePolish = async () => {
    const text = editor.getText().trim();
    if (!text) {
      toast.error('Write an email first, then polish it');
      return;
    }
    setAiGeneratedMessage(null);
    setGeneratedDrafts(null);
    await handleAiGenerate(
      `Polish and improve this email. Fix any grammar or spelling issues, improve clarity and flow, and make it sound more professional while keeping the same tone and meaning:\n\n${text}`,
    );
  };

  const saveDraft = useCallback(async () => {
    const values = getValues();

    if (!hasUnsavedChanges) return;
    if (!editor) return;
    const messageText = editor.getText();

    if (messageText.trim() === initialMessage.trim()) return;
    if (editor.getHTML() === initialMessage.trim()) return;
    if (!values.to.length || !values.subject.length || !messageText.length) return;
    if (aiGeneratedMessage || aiIsLoading || isGeneratingSubject || generatedDrafts) {
      return;
    }

    try {
      setIsSavingDraft(true);
      const draftData = {
        to: values.to.join(', '),
        cc: values.cc?.join(', '),
        bcc: values.bcc?.join(', '),
        subject: values.subject,
        message: editor.getHTML(),
        attachments: await serializeFiles(values.attachments ?? []),
        id: draftId,
        threadId: threadId ? threadId : null,
        fromEmail: values.fromEmail ? values.fromEmail : null,
      };

      const response = await createDraft(draftData);

      if (response?.id && response.id !== draftId) {
        setDraftId(response.id);
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Failed to save draft');
      setIsSavingDraft(false);
      setHasUnsavedChanges(false);
    } finally {
      setIsSavingDraft(false);
      setHasUnsavedChanges(false);
    }
  }, [
    hasUnsavedChanges,
    editor,
    initialMessage,
    getValues,
    aiGeneratedMessage,
    aiIsLoading,
    isGeneratingSubject,
    generatedDrafts,
    draftId,
    threadId,
    createDraft,
    setDraftId,
  ]);

  const handleGenerateSubject = async () => {
    try {
      setIsGeneratingSubject(true);
      const messageText = editor.getText().trim();

      if (!messageText) {
        toast.error('Please enter some message content first');
        return;
      }

      const { subject } = await generateEmailSubject({ message: messageText });
      setValue('subject', subject);
      setHasUnsavedChanges(true);
    } catch (error) {
      console.error('Error generating subject:', error);
      toast.error('Failed to generate subject');
    } finally {
      setIsGeneratingSubject(false);
    }
  };

  const handleClose = () => {
    const hasContent = editor?.getText()?.trim().length > 0;
    if (hasContent) {
      setShowLeaveConfirmation(true);
    } else {
      onClose?.();
    }
  };

  const confirmLeave = () => {
    setShowLeaveConfirmation(false);
    onClose?.();
  };

  const cancelLeave = () => {
    setShowLeaveConfirmation(false);
  };

  // Component unmount protection
  useEffect(() => {
    return () => {
      // This cleanup runs when component is about to unmount
      const hasContent = editor?.getText()?.trim().length > 0;
      if (hasContent && !showLeaveConfirmation) {
        // If we have content and haven't shown confirmation, it means
        // the component is being unmounted unexpectedly
        console.warn('Email composer unmounting with unsaved content');
      }
    };
  }, [editor, showLeaveConfirmation]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const autoSaveTimer = setTimeout(() => {
      console.log('timeout set');
      saveDraft();
    }, 3000);

    return () => clearTimeout(autoSaveTimer);
  }, [hasUnsavedChanges, saveDraft]);

  useEffect(() => {
    const handlePasteFiles = (event: ClipboardEvent) => {
      const clipboardData = event.clipboardData;
      if (!clipboardData || !clipboardData.files.length) return;

      const pastedFiles = Array.from(clipboardData.files);
      if (pastedFiles.length > 0) {
        event.preventDefault();
        handleAttachment(pastedFiles);
        toast.success(`${pluralize('file', pastedFiles.length, true)} attached`);
      }
    };

    document.addEventListener('paste', handlePasteFiles);
    return () => {
      document.removeEventListener('paste', handlePasteFiles);
    };
  }, [handleAttachment]);

  // useHotkeys('meta+y', async (e) => {
  //   if (!editor.getText().trim().length && !subjectInput.trim().length) {
  //     toast.error('Please enter a subject or a message');
  //     return;
  //   }
  //   if (!subjectInput.trim()) {
  //     await handleGenerateSubject();
  //   }
  //   setAiGeneratedMessage(null);
  //   await handleAiGenerate();
  // });

  // keep fromEmail in sync when settings or aliases load afterwards
  useEffect(() => {
    const preferred =
      settings?.settings?.defaultEmailAlias ??
      aliases?.find((a) => a.primary)?.email ??
      aliases?.[0]?.email;

    if (preferred && getValues('fromEmail') !== preferred) {
      setValue('fromEmail', preferred, { shouldDirty: false });
    }
  }, [settings?.settings?.defaultEmailAlias, aliases, getValues, setValue]);

  const handleQualityChange = async (newQuality: ImageQuality) => {
    setImageQuality(newQuality);
    await processAndSetAttachments(originalAttachments, newQuality, true);
  };

  const handleScheduleChange = useCallback((value?: string) => {
    setScheduleAt(value);
  }, []);

  const handleScheduleValidityChange = useCallback((valid: boolean) => {
    setIsScheduleValid(valid);
  }, []);

  const replaceEmojiShortcodes = (text: string): string => {
    if (!text.trim().length || !text.includes(':')) return text;
    return text.replace(shortcodeRegex, (match, shortcode): string => {
      const emoji = gitHubEmojis.find(
        (e) => e.shortcodes.includes(shortcode) || e.name === shortcode,
      );
      return emoji?.emoji ?? match;
    });
  };

  return (
    <div
      className={cn(
        'flex max-h-[500px] w-full max-w-[750px] flex-col overflow-hidden rounded-2xl bg-[#FAFAFA] shadow-sm dark:bg-[#202020]',
        className,
      )}
    >
      <div className="no-scrollbar dark:bg-panelDark flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl">
        {/* To, Cc, Bcc */}
        <div className="shrink-0 overflow-visible border-b border-[#E7E7E7] pb-2 dark:border-[#252525]">
          <div className="flex justify-between px-3 pt-3">
            <div className="flex w-full items-center gap-2">
              <p className="text-sm font-medium text-[#8C8C8C]">To:</p>
              <RecipientAutosuggest
                control={form.control}
                name="to"
                placeholder="Enter email address"
                disabled={isLoading}
              />
            </div>

            <div className="flex gap-2">
              <button
                tabIndex={-1}
                className="flex h-full cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-sm font-medium text-[#8C8C8C] transition-colors hover:bg-gray-50 hover:text-[#A8A8A8] dark:hover:bg-[#404040]"
                onClick={() => setShowCc(!showCc)}
              >
                <span>Cc</span>
              </button>
              <button
                tabIndex={-1}
                className="flex h-full cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-sm font-medium text-[#8C8C8C] transition-colors hover:bg-gray-50 hover:text-[#A8A8A8] dark:hover:bg-[#404040]"
                onClick={() => setShowBcc(!showBcc)}
              >
                <span>Bcc</span>
              </button>
              {onClose && (
                <button
                  tabIndex={-1}
                  className="flex h-full cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-sm font-medium text-[#8C8C8C] transition-colors hover:bg-gray-50 hover:text-[#A8A8A8] dark:hover:bg-[#404040]"
                  onClick={handleClose}
                >
                  <X className="h-3.5 w-3.5 fill-[#9A9A9A]" />
                </button>
              )}
            </div>
          </div>

          <div className={`flex flex-col gap-2 ${showCc || showBcc ? 'pt-2' : ''}`}>
            {/* CC Section */}
            {showCc && (
              <div className="flex items-center gap-2 px-3">
                <p className="text-sm font-medium text-[#8C8C8C]">Cc:</p>
                <RecipientAutosuggest
                  control={form.control}
                  name="cc"
                  placeholder="Enter email for Cc"
                  disabled={isLoading}
                />
              </div>
            )}

            {/* BCC Section */}
            {showBcc && (
              <div className="flex items-center gap-2 px-3">
                <p className="text-sm font-medium text-[#8C8C8C]">Bcc:</p>
                <RecipientAutosuggest
                  control={form.control}
                  name="bcc"
                  placeholder="Enter email for Bcc"
                  disabled={isLoading}
                />
              </div>
            )}
          </div>
        </div>

        {/* Subject */}
        {!activeReplyId ? (
          <div className="flex items-center gap-2 border-b p-3">
            <p className="text-sm font-medium text-[#8C8C8C]">Subject:</p>
            <input
              className="h-4 w-full bg-transparent text-sm font-normal leading-normal text-black placeholder:text-[#797979] focus:outline-none dark:text-white/90"
              placeholder="Re: Design review feedback"
              value={subjectInput}
              onChange={(e) => {
                const value = replaceEmojiShortcodes(e.target.value);
                setValue('subject', value);
                setHasUnsavedChanges(true);
              }}
            />
            <button
              onClick={handleGenerateSubject}
              disabled={isLoading || isGeneratingSubject || messageLength < 1}
              className="cursor-pointer rounded p-1 transition-colors hover:bg-gray-50 dark:hover:bg-[#404040]"
            >
              <div className="flex items-center justify-center gap-2.5 pl-0.5">
                <div className="flex h-5 items-center justify-center gap-1 rounded-sm">
                  {isGeneratingSubject ? (
                    <Loader className="h-3.5 w-3.5 animate-spin fill-black dark:fill-white" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 fill-black dark:fill-white" />
                  )}
                </div>
              </div>
            </button>
          </div>
        ) : null}

        {/* From */}
        {aliases && aliases.length > 1 ? (
          <div className="flex items-center gap-2 border-b p-3">
            <p className="text-sm font-medium text-[#8C8C8C]">From:</p>
            <Select
              value={fromEmail || ''}
              onValueChange={(value) => {
                setValue('fromEmail', value);
                setHasUnsavedChanges(true);
              }}
            >
              <SelectTrigger className="h-6 flex-1 border-0 bg-transparent p-0 text-sm font-normal text-black placeholder:text-[#797979] focus:outline-none focus:ring-0 dark:text-white/90">
                <SelectValue placeholder="Select an email address" />
              </SelectTrigger>
              <SelectContent className="z-99999">
                {aliases.map((alias) => (
                  <SelectItem key={alias.email} value={alias.email}>
                    <div className="flex flex-row items-center gap-1">
                      <span className="text-sm">
                        {alias.name ? `${alias.name} <${alias.email}>` : alias.email}
                      </span>
                      {alias.primary && <span className="text-xs text-[#8C8C8C]">Primary</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {/* Message Content */}
        <div className="flex-1 overflow-y-auto border-t bg-[#FFFFFF] px-3 py-3 outline-white/5 dark:bg-[#202020]">
          <AgentThinkingAccordion steps={agentSteps} isThinking={agentIsThinking} />
          <div
            onClick={() => {
              editor.commands.focus();
            }}
            className={cn(
              `min-h-[200px] w-full`,
              editorClassName,
              aiGeneratedMessage !== null ||
                (generatedDrafts !== null && generatedDrafts.length > 1)
                ? 'blur-sm'
                : '',
            )}
          >
            <EditorContent editor={editor} className="h-full w-full max-w-full overflow-x-auto" />
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex w-full shrink-0 flex-col gap-2 self-stretch rounded-b-2xl bg-[#FFFFFF] px-3 py-3 outline-white/5 sm:flex-row sm:items-end sm:justify-between dark:bg-[#202020]">
        <div className="flex flex-col items-start justify-start gap-2">
          {toggleToolbar && <Toolbar editor={editor} />}
          <div className="flex flex-wrap items-center justify-start gap-2">
            <Button
              size={'xs'}
              onClick={handleSend}
              disabled={isLoading || settingsLoading || !isScheduleValid}
            >
              <div className="flex items-center justify-center">
                <div className="text-center text-sm leading-none text-white dark:text-black">
                  <span>Send </span>
                </div>
              </div>
              <div className="flex h-5 items-center justify-center gap-1 rounded-sm bg-white/10 px-1 dark:bg-black/10">
                <Command className="h-3.5 w-3.5 text-white dark:text-black" />
                <CurvedArrow className="mt-1.5 h-4 w-4 fill-white dark:fill-black" />
              </div>
            </Button>
            <ScheduleSendPicker
              value={scheduleAt}
              onChange={handleScheduleChange}
              onValidityChange={handleScheduleValidityChange}
            />
            <Button
              variant={'secondary'}
              size={'xs'}
              onClick={() => fileInputRef.current?.click()}
              className="bg-background cursor-pointer border transition-colors hover:bg-gray-50 dark:hover:bg-[#404040]"
            >
              <Plus className="h-3 w-3 fill-[#9A9A9A]" />
              <span className="hidden px-0.5 text-sm md:block">Add</span>
            </Button>
            <TemplateButton
              editor={editor}
              subject={subjectInput}
              setSubject={(value) => setValue('subject', value)}
              to={toEmails}
              cc={ccEmails ?? []}
              bcc={bccEmails ?? []}
              setRecipients={(field, val) => setValue(field, val)}
            />
            <Input
              type="file"
              id="attachment-input"
              className="hidden"
              onChange={async (event) => {
                const fileList = event.target.files;
                if (fileList) {
                  await handleAttachment(Array.from(fileList));
                }
              }}
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              ref={fileInputRef}
              style={{ zIndex: 100 }}
            />
            {attachments && attachments.length > 0 && (
              <Popover modal={true}>
                <PopoverTrigger asChild>
                  <button
                    className="focus-visible:ring-ring flex cursor-pointer items-center gap-1.5 rounded-md border border-[#E7E7E7] bg-white/5 px-2 py-1 text-sm hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:border-[#2B2B2B]"
                    aria-label={`View ${attachments.length} attached ${pluralize('file', attachments.length)}`}
                  >
                    <Paperclip className="h-3.5 w-3.5 text-[#9A9A9A]" />
                    <span className="font-medium">{attachments.length}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="z-100 w-[340px] rounded-lg p-0 shadow-lg dark:bg-[#202020]"
                  align="start"
                  sideOffset={6}
                >
                  <div className="flex flex-col">
                    <div className="border-b border-[#E7E7E7] p-3 dark:border-[#2B2B2B]">
                      <h4 className="text-sm font-semibold text-black dark:text-white/90">
                        Attachments
                      </h4>
                      <p className="text-muted-foreground text-xs dark:text-[#9B9B9B]">
                        {pluralize('file', attachments.length, true)}
                      </p>
                    </div>

                    <div className="border-b border-[#E7E7E7] p-3 dark:border-[#2B2B2B]">
                      <ImageCompressionSettings
                        quality={imageQuality}
                        onQualityChange={handleQualityChange}
                        className="border-0 shadow-none"
                      />
                    </div>

                    <div className="max-h-[250px] flex-1 space-y-0.5 overflow-y-auto p-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {attachments.map((file: File, index: number) => {
                        const nameParts = file.name.split('.');
                        const extension = nameParts.length > 1 ? nameParts.pop() : undefined;
                        const nameWithoutExt = nameParts.join('.');
                        const maxNameLength = 22;
                        const truncatedName =
                          nameWithoutExt.length > maxNameLength
                            ? `${nameWithoutExt.slice(0, maxNameLength)}…`
                            : nameWithoutExt;
                        return (
                          <div
                            key={file.name + index}
                            className="group flex items-center justify-between gap-3 rounded-md px-1.5 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#F0F0F0] dark:bg-[#2C2C2C]">
                                {file.type.startsWith('image/') ? (
                                  <img
                                    src={URL.createObjectURL(file)}
                                    alt={file.name}
                                    className="h-full w-full rounded object-cover"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <span className="text-sm" aria-hidden="true">
                                    {file.type.includes('pdf')
                                      ? '📄'
                                      : file.type.includes('excel') ||
                                          file.type.includes('spreadsheetml')
                                        ? '📊'
                                        : file.type.includes('word') ||
                                            file.type.includes('wordprocessingml')
                                          ? '📝'
                                          : '📎'}
                                  </span>
                                )}
                              </div>
                              <div className="flex min-w-0 flex-1 flex-col">
                                <p
                                  className="flex items-baseline text-sm text-black dark:text-white/90"
                                  title={file.name}
                                >
                                  <span className="truncate">{truncatedName}</span>
                                  {extension && (
                                    <span className="ml-0.5 shrink-0 text-[10px] text-[#8C8C8C] dark:text-[#9A9A9A]">
                                      .{extension}
                                    </span>
                                  )}
                                </p>
                                <p className="text-muted-foreground text-xs dark:text-[#9B9B9B]">
                                  {formatFileSize(file.size)}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={async (e: React.MouseEvent<HTMLButtonElement>) => {
                                e.preventDefault();
                                e.stopPropagation();

                                try {
                                  await removeAttachment(index);
                                } catch (error) {
                                  console.error('Failed to remove attachment:', error);
                                  toast.error('Failed to remove attachment');
                                }
                              }}
                              className="focus-visible:ring-ring ml-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-transparent hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2"
                              aria-label={`Remove ${file.name}`}
                            >
                              <XIcon className="text-muted-foreground h-3.5 w-3.5 hover:text-black dark:text-[#9B9B9B] dark:hover:text-white" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    tabIndex={-1}
                    variant="ghost"
                    size="icon"
                    onClick={() => setToggleToolbar(!toggleToolbar)}
                    className={`h-auto w-auto rounded p-1.5 ${toggleToolbar ? 'bg-muted' : 'bg-background'} cursor-pointer border transition-colors hover:bg-gray-50 dark:hover:bg-[#404040]`}
                  >
                    <Type className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Formatting options</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <div className="flex w-full items-start justify-start gap-2 sm:w-auto sm:justify-end">
          <div className="relative">
            <AnimatePresence>
              {generatedDrafts !== null && generatedDrafts.length > 1 ? (
                <DraftSelector
                  drafts={generatedDrafts}
                  onSelect={(draft) => {
                    editor.commands.setContent({
                      type: 'doc',
                      content: draft.body.split(/\r?\n/).map((line) => {
                        return {
                          type: 'paragraph',
                          content: line.trim().length === 0 ? [] : [{ type: 'text', text: line }],
                        };
                      }),
                    });
                    // Track the AI draft for correction learning
                    trackAiDraft(draft.body);

                    // Track selection for learning
                    const values = getValues();
                    const rejectedApproaches = generatedDrafts
                      .filter((d) => d.id !== draft.id)
                      .map((d) => d.approach);

                    trackSelection({
                      selectedApproach: draft.approach,
                      rejectedApproaches,
                      recipientEmail: values.to[0] ?? '',
                      subject: values.subject,
                      threadDepth: 0,
                    }).catch(() => {
                      // Silently ignore errors - learning is non-critical
                    });

                    // Update subject if the draft includes one
                    if (draft.subject) {
                      setValue('subject', draft.subject);
                    }

                    // Append To recipients (deduplicated)
                    if (draft.to && draft.to.length > 0) {
                      const currentTo = values.to || [];
                      const newTo = [...new Set([...currentTo, ...draft.to])];
                      setValue('to', newTo, { shouldDirty: true });
                    }

                    // Append Cc recipients (deduplicated) and show CC field
                    if (draft.cc && draft.cc.length > 0) {
                      const currentCc = values.cc || [];
                      const newCc = [...new Set([...currentCc, ...draft.cc])];
                      setValue('cc', newCc, { shouldDirty: true });
                      setShowCc(true);
                    }

                    setGeneratedDrafts(null);
                  }}
                  onReject={() => {
                    setGeneratedDrafts(null);
                    clearTracking();
                  }}
                />
              ) : aiGeneratedMessage !== null ? (
                <ContentPreview
                  content={aiGeneratedMessage}
                  onAccept={() => {
                    editor.commands.setContent({
                      type: 'doc',
                      content: aiGeneratedMessage.split(/\r?\n/).map((line) => {
                        return {
                          type: 'paragraph',
                          content: line.trim().length === 0 ? [] : [{ type: 'text', text: line }],
                        };
                      }),
                    });
                    // Track the AI draft for correction learning
                    trackAiDraft(aiGeneratedMessage);
                    setAiGeneratedMessage(null);
                  }}
                  onReject={() => {
                    setAiGeneratedMessage(null);
                    clearTracking();
                  }}
                />
              ) : null}
            </AnimatePresence>
            <AnimatePresence mode="wait">
              {helpMeWriteOpen ? (
                <motion.div
                  key="help-me-write-bar"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{
                    width: 'auto',
                    opacity: 1,
                    transition: {
                      width: { type: 'spring', stiffness: 250, damping: 35 },
                      opacity: { duration: 0.3 },
                    },
                  }}
                  exit={{
                    width: 0,
                    opacity: 0,
                    transition: {
                      width: { type: 'spring', stiffness: 250, damping: 35 },
                      opacity: { duration: 0.2 },
                    },
                  }}
                  className="flex items-center gap-1.5 overflow-hidden rounded-full border border-[#E7E7E7] bg-white px-2 py-1 dark:border-[#3A3A3A] dark:bg-[#2A2A2A]"
                >
                  <PencilCompose className="h-3.5 w-3.5 shrink-0 fill-[#8C8C8C]" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Help me write..."
                    value={helpMeWritePrompt}
                    onChange={(e) => setHelpMeWritePrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && helpMeWritePrompt.trim()) {
                        e.preventDefault();
                        void handleHelpMeWrite();
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        setHelpMeWriteOpen(false);
                        setHelpMeWritePrompt('');
                      }
                    }}
                    className="w-full min-w-0 bg-transparent text-sm text-black placeholder:text-[#8C8C8C] focus:outline-none sm:w-[260px] dark:text-white"
                    disabled={aiIsLoading}
                  />
                  <Button
                    size="xs"
                    variant="ghost"
                    className="h-6 shrink-0 cursor-pointer px-1.5 text-xs text-[#8C8C8C] hover:text-black dark:hover:text-white"
                    onClick={() => {
                      setHelpMeWriteOpen(false);
                      setHelpMeWritePrompt('');
                    }}
                    disabled={aiIsLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="xs"
                    className="h-6 shrink-0 cursor-pointer px-2 text-xs"
                    onClick={() => void handleHelpMeWrite()}
                    disabled={!helpMeWritePrompt.trim() || isLoading || aiIsLoading}
                  >
                    {aiIsLoading ? (
                      <Loader className="h-3 w-3 animate-spin" />
                    ) : (
                      'Create'
                    )}
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="help-me-write-buttons"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.2 } }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  className="flex items-center gap-1.5"
                >
                  <Button
                    size="xs"
                    variant="ghost"
                    className="cursor-pointer gap-1.5 rounded-full border border-[#E7E7E7] dark:border-[#3A3A3A]"
                    onClick={() => setHelpMeWriteOpen(true)}
                    disabled={isLoading || aiIsLoading}
                  >
                    <PencilCompose className="h-3 w-3 fill-[#8C8C8C]" />
                    <span className="hidden text-sm text-[#8C8C8C] md:inline">
                      Help me write
                    </span>
                  </Button>
                  {messageLength >= 1 && (
                    <>
                      <Button
                        size="xs"
                        variant="ghost"
                        className="cursor-pointer gap-1.5 rounded-full border border-[#E7E7E7] dark:border-[#3A3A3A]"
                        onClick={() => void handlePolish()}
                        disabled={isLoading || aiIsLoading}
                      >
                        <Wand2 className="h-3.5 w-3.5 text-[#8C8C8C]" />
                        <span className="hidden text-sm text-[#8C8C8C] md:inline">
                          Polish
                        </span>
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        className="cursor-pointer gap-1.5 rounded-full border border-[#E7E7E7] dark:border-[#3A3A3A]"
                        onClick={() => void handleMakeConcise()}
                        disabled={isLoading || aiIsLoading}
                      >
                        <ListFilter className="h-3.5 w-3.5 text-[#8C8C8C]" />
                        <span className="hidden text-sm text-[#8C8C8C] md:inline">
                          Make concise
                        </span>
                      </Button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <Dialog open={showLeaveConfirmation} onOpenChange={setShowLeaveConfirmation}>
        <DialogContent showOverlay className="z-99999 sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Discard message?</DialogTitle>
            <DialogDescription>
              You have unsaved changes in your email. Are you sure you want to leave? Your changes
              will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={cancelLeave} className="cursor-pointer">
              Stay
            </Button>
            <Button variant="destructive" onClick={confirmLeave} className="cursor-pointer">
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAttachmentWarning} onOpenChange={setShowAttachmentWarning}>
        <DialogContent showOverlay className="z-99999 sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Attachment Warning</DialogTitle>
            <DialogDescription>
              Looks like you mentioned an attachment in your message, but there are no files
              attached. Are you sure you want to send this email?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAttachmentWarning(false);
              }}
              className="cursor-pointer"
            >
              Recheck
            </Button>
            <Button
              onClick={() => {
                setShowAttachmentWarning(false);
                void proceedWithSend();
              }}
              className="cursor-pointer"
            >
              Send Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const animations = {
  container: {
    initial: { width: 32, opacity: 0 },
    animate: (width: number) => ({
      width: width < 640 ? '200px' : '400px',
      opacity: 1,
      transition: {
        width: { type: 'spring', stiffness: 250, damping: 35 },
        opacity: { duration: 0.4 },
      },
    }),
    exit: {
      width: 32,
      opacity: 0,
      transition: {
        width: { type: 'spring', stiffness: 250, damping: 35 },
        opacity: { duration: 0.4 },
      },
    },
  },
  content: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { delay: 0.15, duration: 0.4 } },
    exit: { opacity: 0, transition: { duration: 0.3 } },
  },
  input: {
    initial: { y: 10, opacity: 0 },
    animate: { y: 0, opacity: 1, transition: { delay: 0.3, duration: 0.4 } },
    exit: { y: 10, opacity: 0, transition: { duration: 0.3 } },
  },
  button: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1, transition: { delay: 0.4, duration: 0.3 } },
    exit: { opacity: 0, scale: 0.8, transition: { duration: 0.2 } },
  },
  card: {
    initial: { opacity: 0, y: 10, scale: 0.95 },
    animate: { opacity: 1, y: -10, scale: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.2 } },
  },
};

const ContentPreview = ({
  content,
  onAccept,
  onReject,
}: {
  content: string;
  onAccept?: (value: string) => void | Promise<void>;
  onReject?: () => void | Promise<void>;
}) => (
  <motion.div
    variants={animations.card}
    initial="initial"
    animate="animate"
    exit="exit"
    className="dark:bg-subtleBlack absolute bottom-full right-0 z-50 w-[calc(100vw-2rem)] overflow-hidden rounded-xl border bg-white p-1 shadow-md sm:w-[400px]"
  >
    <div
      className="max-h-60 min-h-[150px] overflow-auto rounded-md p-1 text-sm"
      style={{
        scrollbarGutter: 'stable',
      }}
    >
      {content.split('\n').map((line, i) => {
        return (
          <TextEffect
            per="char"
            preset="blur"
            as="div"
            className="whitespace-pre-wrap"
            speedReveal={3}
            key={i}
          >
            {line}
          </TextEffect>
        );
      })}
    </div>
    <div className="flex justify-end gap-2 p-2">
      <button
        className="flex h-7 cursor-pointer items-center gap-0.5 overflow-hidden rounded-md border bg-red-700 px-1.5 text-sm shadow-sm transition-colors hover:bg-red-800 dark:border-none"
        onClick={async () => {
          if (onReject) {
            await onReject();
          }
        }}
      >
        <div className="flex h-5 items-center justify-center gap-1 rounded-sm">
          <XIcon className="h-3.5 w-3.5" />
        </div>
        <span>Reject</span>
      </button>
      <button
        className="flex h-7 cursor-pointer items-center gap-0.5 overflow-hidden rounded-md border bg-green-700 px-1.5 text-sm shadow-sm transition-colors hover:bg-green-800 dark:border-none"
        onClick={async () => {
          if (onAccept) {
            await onAccept(content);
          }
        }}
      >
        <div className="flex h-5 items-center justify-center gap-1 rounded-sm">
          <Check className="h-3.5 w-3.5" />
        </div>
        <span>Accept</span>
      </button>
    </div>
  </motion.div>
);
