'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { useGenerateWorkflow, useRefineDraft } from '@/hooks/use-workflows';
import { cn } from '@/lib/utils';
import { Send, Sparkles, User, Bot } from 'lucide-react';
import { DraftPreview } from './draft-preview';

// ============================================================================
// Type Definitions
// ============================================================================

interface WorkflowDraftNode {
  id: string;
  type: 'trigger' | 'condition' | 'action';
  nodeType: string;
  name: string;
  position: [number, number];
  parameters: Record<string, unknown>;
  disabled?: boolean;
}

interface WorkflowDraftConnections {
  [key: string]: {
    main: Array<Array<{ node: string; index: number }>>;
  };
}

interface WorkflowDraft {
  name: string;
  description?: string;
  nodes: WorkflowDraftNode[];
  connections: WorkflowDraftConnections;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  draft?: WorkflowDraft;
  assumptions?: string[];
  questions?: string[];
}

export interface WorkflowChatProps {
  onDraftGenerated: (
    draft: WorkflowDraft,
    explanation: string,
    assumptions: string[],
    questions?: string[],
  ) => void;
  onApplyDraft?: () => void;
  labels: Array<{ id: string; name: string }>;
  skills: Array<{ id: string; name: string }>;
}

// ============================================================================
// Example Prompts
// ============================================================================

const EXAMPLE_PROMPTS = [
  'Archive all newsletters older than 7 days',
  "Auto-label emails from my team with 'Team Updates'",
  'Send Slack notification when I receive emails from VIP contacts',
];

// ============================================================================
// ExamplePrompts Component
// ============================================================================

interface ExamplePromptsProps {
  onPromptClick: (prompt: string) => void;
}

function ExamplePrompts({ onPromptClick }: ExamplePromptsProps) {
  return (
    <div className="relative mt-4 flex w-full flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center gap-2 px-4">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onPromptClick(prompt)}
            className="shrink-0 rounded-md bg-[#f0f0f0] p-1.5 px-3 text-sm text-[#555555] transition-colors hover:bg-[#e5e5e5] dark:bg-[#262626] dark:text-[#929292] dark:hover:bg-[#303030]"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MessageBubble Component
// ============================================================================

interface MessageBubbleProps {
  message: ChatMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('mb-3 flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
      <div className="flex items-start gap-2">
        {!isUser && (
          <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
        )}
        <div
          className={cn(
            'max-w-[85%] rounded-lg px-3 py-2 text-sm',
            isUser
              ? 'bg-[#f0f0f0] text-[#262626] dark:bg-[#252525] dark:text-[#e5e5e5]'
              : 'bg-transparent text-foreground',
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        {isUser && (
          <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// WorkflowChat Component
// ============================================================================

export function WorkflowChat({ onDraftGenerated, onApplyDraft, labels, skills }: WorkflowChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [currentDraft, setCurrentDraft] = useState<WorkflowDraft | null>(null);
  const [draftExplanation, setDraftExplanation] = useState<string>('');
  const [draftAssumptions, setDraftAssumptions] = useState<string[]>([]);
  const [draftQuestions, setDraftQuestions] = useState<string[] | undefined>(undefined);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const generateWorkflow = useGenerateWorkflow();
  const refineDraft = useRefineDraft();

  const isLoading = generateWorkflow.isPending || refineDraft.isPending;

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  // Add user message to the chat
  const addUserMessage = useCallback((content: string) => {
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    };
    setMessages((prev) => [...prev, userMessage]);
  }, []);

  // Add assistant message to the chat
  const addAssistantMessage = useCallback(
    (
      content: string,
      draft?: WorkflowDraft,
      assumptions?: string[],
      questions?: string[],
    ) => {
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content,
        draft,
        assumptions,
        questions,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    },
    [],
  );

  // Handle form submission
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      const trimmedInput = inputText.trim();
      if (!trimmedInput || isLoading) return;

      // Add user message immediately
      addUserMessage(trimmedInput);
      setInputText('');

      try {
        if (!currentDraft) {
          // Generate new workflow
          const result = await generateWorkflow.mutateAsync({
            prompt: trimmedInput,
            context: {
              existingLabels: labels.map((l) => l.name),
              existingSkills: skills,
            },
          });

          // Update state with the draft
          setCurrentDraft(result.draft);
          setDraftExplanation(result.explanation);
          setDraftAssumptions(result.assumptions);
          setDraftQuestions(result.questions);

          // Add assistant message
          addAssistantMessage(
            result.explanation,
            result.draft,
            result.assumptions,
            result.questions,
          );

          // Notify parent
          onDraftGenerated(
            result.draft,
            result.explanation,
            result.assumptions,
            result.questions,
          );
        } else {
          // Refine existing draft
          const result = await refineDraft.mutateAsync({
            currentDraft,
            feedback: trimmedInput,
          });

          // Update state with the refined draft
          setCurrentDraft(result.draft);
          setDraftExplanation(result.explanation);
          setDraftAssumptions(result.assumptions);
          setDraftQuestions(result.questions);

          // Add assistant message
          addAssistantMessage(
            result.explanation,
            result.draft,
            result.assumptions,
            result.questions,
          );

          // Notify parent
          onDraftGenerated(
            result.draft,
            result.explanation,
            result.assumptions,
            result.questions,
          );
        }
      } catch (error) {
        // Add error message
        const errorMessage =
          error instanceof Error ? error.message : 'An error occurred. Please try again.';
        addAssistantMessage(`Sorry, I encountered an error: ${errorMessage}`);
      }
    },
    [
      inputText,
      isLoading,
      currentDraft,
      addUserMessage,
      addAssistantMessage,
      generateWorkflow,
      refineDraft,
      labels,
      skills,
      onDraftGenerated,
    ],
  );

  // Handle example prompt click
  const handleExampleClick = useCallback((prompt: string) => {
    setInputText(prompt);
    textareaRef.current?.focus();
  }, []);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  // Handle applying the draft to the canvas
  const handleApplyDraft = useCallback(() => {
    onApplyDraft?.();
  }, [onApplyDraft]);

  // Handle clearing the draft state
  const handleClearDraft = useCallback(() => {
    setCurrentDraft(null);
    setDraftExplanation('');
    setDraftAssumptions([]);
    setDraftQuestions(undefined);
  }, []);

  const isEmpty = messages.length === 0;
  const hasDraft = currentDraft !== null && draftExplanation !== '';

  return (
    <div className="flex h-full flex-col">
      {/* Messages Area */}
      <ScrollArea className="flex-1">
        <div className="min-h-full px-3 py-4">
          {isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center pt-8">
              <div className="relative mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-1 text-center text-base font-medium text-foreground">
                Describe your workflow
              </h3>
              <p className="mb-4 max-w-xs text-center text-sm text-muted-foreground">
                Tell me what you want to automate in plain English
              </p>
              <ExamplePrompts onPromptClick={handleExampleClick} />
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 py-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <TextShimmer className="text-sm text-muted-foreground">
                    Generating workflow...
                  </TextShimmer>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} className="h-0 w-0" />
        </div>
      </ScrollArea>

      {/* Draft Preview */}
      {hasDraft && currentDraft && (
        <div className="shrink-0 border-t px-3 py-3">
          <DraftPreview
            draft={currentDraft}
            explanation={draftExplanation}
            assumptions={draftAssumptions}
            questions={draftQuestions}
            onApply={handleApplyDraft}
            onClear={handleClearDraft}
          />
        </div>
      )}

      {/* Input Area */}
      <div className={cn('shrink-0 px-3 py-3', !hasDraft && 'border-t')}>
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative flex items-end rounded-lg bg-muted/50 p-2">
            <Textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                currentDraft
                  ? 'Refine your workflow (e.g., "also add a delay of 1 day")'
                  : 'Describe what you want to automate...'
              }
              disabled={isLoading}
              className="min-h-[40px] max-h-[120px] flex-1 resize-none border-0 bg-transparent p-1 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={1}
            />
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              disabled={!inputText.trim() || isLoading}
              className="h-8 w-8 shrink-0"
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send message</span>
            </Button>
          </div>
          {currentDraft && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Draft active - your message will refine the current workflow
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
