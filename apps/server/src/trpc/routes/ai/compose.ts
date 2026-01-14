import {
  getWritingStyleMatrixForConnectionId,
  type WritingStyleMatrix,
} from '../../../services/writing-style-service';
import {
  StyledEmailAssistantSystemPrompt,
  MultiDraftEmailAssistantSystemPrompt,
} from '../../../lib/prompts';
import { escapeXml } from '../../../thread-workflow-utils/workflow-utils';
import { webSearch } from '../../../routes/agent/tools';
import { activeConnectionProcedure } from '../../trpc';
import { generateText, generateObject } from 'ai';
import { getPrompt } from '../../../lib/brain';
import { stripHtml } from 'string-strip-html';
import { EPrompts } from '../../../types';
import { openai } from '@ai-sdk/openai';
import { env } from '../../../env';
import { z } from 'zod';

export type Draft = {
  id: string;
  body: string;
  approach: string;
  subject?: string;
};

export type ComposeResult = {
  newBody: string;
  drafts: Draft[];
};

type ComposeEmailInput = {
  prompt: string;
  emailSubject?: string;
  to?: string[];
  cc?: string[];
  threadMessages?: Array<{
    from: string;
    to: string[];
    cc?: string[];
    subject: string;
    body: string;
  }>;
  username: string;
  connectionId: string;
  generateMultipleDrafts?: boolean;
};

export async function composeEmail(input: ComposeEmailInput) {
  const { prompt, threadMessages = [], cc, emailSubject, to, username, connectionId } = input;

  const writingStyleMatrix = await getWritingStyleMatrixForConnectionId({
    connectionId,
  });

  const systemPrompt = await getPrompt(
    `${connectionId}-${EPrompts.Compose}`,
    StyledEmailAssistantSystemPrompt(),
  );
  const userPrompt = EmailAssistantPrompt({
    currentSubject: emailSubject,
    recipients: [...(to ?? []), ...(cc ?? [])],
    prompt,
    username,
    styleProfile: writingStyleMatrix?.style as WritingStyleMatrix,
  });

  const threadUserMessages = threadMessages.map((message) => ({
    role: 'user' as const,
    content: MessagePrompt({
      ...message,
      body: stripHtml(message.body).result,
    }),
  }));

  const messages =
    threadMessages.length > 0
      ? [
          {
            role: 'user' as const,
            content: "I'm going to give you the current email thread replies one by one.",
          } as const,
          {
            role: 'assistant' as const,
            content: 'Got it. Please proceed with the thread replies.',
          } as const,
          ...threadUserMessages,
          {
            role: 'assistant' as const,
            content: 'Got it. Please proceed with the email composition prompt.',
          },
        ]
      : [
          {
            role: 'user' as const,
            content: 'Now, I will give you the prompt to write the email.',
          },
          {
            role: 'assistant' as const,
            content: 'Ok, please continue with the email composition prompt.',
          },
        ];

  const { text } = await generateText({
    model: openai(env.OPENAI_MINI_MODEL || 'gpt-4o-mini'),
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...messages,
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    maxSteps: 10,
    maxTokens: 2_000,
    temperature: 0.35,
    frequencyPenalty: 0.2,
    presencePenalty: 0.1,
    maxRetries: 1,
    tools: {
      webSearch: webSearch(),
    },
  });

  return text;
}

/**
 * Generate multiple email drafts with different response approaches.
 * The model uses search tools to gather context and then reasons about
 * the 2 most probable response approaches.
 */
export async function composeEmailWithMultipleDrafts(
  input: ComposeEmailInput,
): Promise<ComposeResult> {
  const {
    prompt,
    threadMessages = [],
    cc,
    emailSubject,
    to,
    username,
    connectionId,
    generateMultipleDrafts = true,
  } = input;

  // If not generating multiple drafts, fall back to single draft
  if (!generateMultipleDrafts) {
    const body = await composeEmail(input);
    return {
      newBody: body,
      drafts: [{ id: '1', body, approach: 'Standard response' }],
    };
  }

  const writingStyleMatrix = await getWritingStyleMatrixForConnectionId({
    connectionId,
  });

  const systemPrompt = MultiDraftEmailAssistantSystemPrompt();

  const userPrompt = MultiDraftEmailAssistantPrompt({
    currentSubject: emailSubject,
    recipients: [...(to ?? []), ...(cc ?? [])],
    prompt,
    username,
    styleProfile: writingStyleMatrix?.style as WritingStyleMatrix,
  });

  const threadUserMessages = threadMessages.map((message) => ({
    role: 'user' as const,
    content: MessagePrompt({
      ...message,
      body: stripHtml(message.body).result,
    }),
  }));

  const messages =
    threadMessages.length > 0
      ? [
          {
            role: 'user' as const,
            content: "I'm going to give you the current email thread replies one by one.",
          } as const,
          {
            role: 'assistant' as const,
            content: 'Got it. Please proceed with the thread replies.',
          } as const,
          ...threadUserMessages,
          {
            role: 'assistant' as const,
            content: 'Got it. Please proceed with the email composition prompt.',
          },
        ]
      : [
          {
            role: 'user' as const,
            content: 'Now, I will give you the prompt to write the email.',
          },
          {
            role: 'assistant' as const,
            content: 'Ok, please continue with the email composition prompt.',
          },
        ];

  // Schema for structured multi-draft output
  const multiDraftSchema = z.object({
    drafts: z.array(
      z.object({
        approach: z
          .string()
          .describe(
            'Short label describing this response approach (e.g., "Accept invitation", "Decline politely")',
          ),
        subject: z
          .string()
          .describe(
            'The email subject line for this approach. Do NOT include "Subject:" prefix, just the subject text.',
          ),
        body: z
          .string()
          .describe(
            'The complete email body for this approach. Do NOT include the subject line in the body. Start directly with the greeting (e.g., "Hi," or "Hello,").',
          ),
      }),
    ),
  });

  try {
    const { object } = await generateObject({
      model: openai(env.OPENAI_MODEL || 'gpt-4o'),
      schema: multiDraftSchema,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...messages,
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      maxTokens: 4_000,
      temperature: 0.5,
      maxRetries: 1,
      mode: 'tool',
    });

    const drafts: Draft[] = object.drafts.map((draft, index) => ({
      id: String(index + 1),
      body: draft.body,
      approach: draft.approach,
      subject: draft.subject,
    }));

    return {
      newBody: drafts[0]?.body ?? '',
      drafts,
    };
  } catch (error) {
    console.error('[composeEmailWithMultipleDrafts] Error generating drafts:', error);
    // Fall back to single draft on error
    const body = await composeEmail(input);
    return {
      newBody: body,
      drafts: [{ id: '1', body, approach: 'Standard response' }],
    };
  }
}

export const compose = activeConnectionProcedure
  .input(
    z.object({
      prompt: z.string(),
      emailSubject: z.string().optional(),
      to: z.array(z.string()).optional(),
      cc: z.array(z.string()).optional(),
      threadMessages: z
        .array(
          z.object({
            from: z.string(),
            to: z.array(z.string()),
            cc: z.array(z.string()).optional(),
            subject: z.string(),
            body: z.string(),
          }),
        )
        .optional()
        .default([]),
      generateMultipleDrafts: z.boolean().optional().default(true),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const { sessionUser, activeConnection } = ctx;

    const result = await composeEmailWithMultipleDrafts({
      ...input,
      username: sessionUser.name,
      connectionId: activeConnection.id,
    });

    return result;
  });

export const generateEmailSubject = activeConnectionProcedure
  .input(
    z.object({
      message: z.string(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const { activeConnection } = ctx;
    const { message } = input;

    const writingStyleMatrix = await getWritingStyleMatrixForConnectionId({
      connectionId: activeConnection.id,
    });

    const subject = await generateSubject(message, writingStyleMatrix?.style as WritingStyleMatrix);

    return {
      subject,
    };
  });

const MessagePrompt = ({
  from,
  to,
  cc,
  body,
  subject,
}: {
  from: string;
  to: string[];
  cc?: string[];
  body: string;
  subject: string;
}) => {
  const parts: string[] = [];
  parts.push(`From: ${from}`);
  parts.push(`To: ${to.join(', ')}`);
  if (cc && cc.length > 0) {
    parts.push(`CC: ${cc.join(', ')}`);
  }
  parts.push(`Subject: ${subject}`);
  parts.push('');
  parts.push(`Body: ${body}`);

  return parts.join('\n');
};

const EmailAssistantPrompt = ({
  currentSubject,
  recipients,
  prompt,
  username,
  styleProfile,
}: {
  currentSubject?: string;
  recipients?: string[];
  prompt: string;
  username: string;
  styleProfile?: WritingStyleMatrix | null;
}) => {
  const parts: string[] = [];

  parts.push('# Email Composition Task');
  if (styleProfile) {
    parts.push('## Style Profile');
    parts.push(`\`\`\`json
  ${JSON.stringify(styleProfile, null, 2)}
  \`\`\``);
  }

  parts.push('## Email Context');

  if (currentSubject) {
    parts.push('## The current subject is:');
    parts.push(escapeXml(currentSubject));
    parts.push('');
  }

  if (recipients && recipients.length > 0) {
    parts.push('## The recipients are:');
    parts.push(recipients.join('\n'));
    parts.push('');
  }

  parts.push(
    '## This is a prompt from the user that could be empty, a rough email, or an instruction to write an email.',
  );
  parts.push(escapeXml(prompt));
  parts.push('');

  parts.push("##This is the user's name:");
  parts.push(escapeXml(username));
  parts.push('');

  parts.push(
    'Please write an email using this context and instruction. If there are previous messages in the thread use those for more context.',
    'Make sure to examine all context in this conversation to ALWAYS generate some sort of reply.',
    'Do not include ANYTHING other than the body of the email you write.',
  );

  return parts.join('\n\n');
};

const MultiDraftEmailAssistantPrompt = ({
  currentSubject,
  recipients,
  prompt,
  username,
  styleProfile,
}: {
  currentSubject?: string;
  recipients?: string[];
  prompt: string;
  username: string;
  styleProfile?: WritingStyleMatrix | null;
}) => {
  const parts: string[] = [];

  parts.push('# Email Composition Task - Multiple Response Options');

  if (styleProfile) {
    parts.push('## Your Writing Style Profile');
    parts.push(`\`\`\`json
  ${JSON.stringify(styleProfile, null, 2)}
  \`\`\``);
  }

  parts.push('## Email Context');

  if (currentSubject) {
    parts.push('### Current Subject:');
    parts.push(escapeXml(currentSubject));
    parts.push('');
  }

  if (recipients && recipients.length > 0) {
    parts.push('### Recipients:');
    parts.push(recipients.join('\n'));
    parts.push('');
  }

  parts.push('### User Request/Prompt:');
  parts.push(escapeXml(prompt));
  parts.push('');

  parts.push('### Sender Name:');
  parts.push(escapeXml(username));
  parts.push('');

  parts.push(`## Instructions

Based on the context above and any thread messages provided, generate exactly 2 different email drafts representing the 2 most probable/appropriate response approaches.

For example:
- If responding to an invitation: "Accept invitation" vs "Decline politely"
- If following up: "Detailed response" vs "Brief acknowledgment"
- If handling a request: "Agree to request" vs "Propose alternative"

Each draft should:
1. Match the user's writing style from the profile
2. Be complete and ready to send
3. Have a clear, distinct approach from the other draft
4. Be appropriate for the context and recipients`);

  return parts.join('\n\n');
};

const generateSubject = async (message: string, styleProfile?: WritingStyleMatrix | null) => {
  const parts: string[] = [];

  parts.push('# Email Subject Generation Task');
  if (styleProfile) {
    parts.push('## Style Profile');
    parts.push(`\`\`\`json
  ${JSON.stringify(styleProfile, null, 2)}
  \`\`\``);
  }

  parts.push('## Email Content');
  parts.push(escapeXml(message));
  parts.push('');
  parts.push(
    'Generate a concise, clear subject line that summarizes the main point of the email. The subject should be professional and under 100 characters.',
  );

  const { text } = await generateText({
    model: openai(env.OPENAI_MODEL || 'gpt-4o'),
    messages: [
      {
        role: 'system',
        content:
          'You are an email subject line generator. Generate a concise, clear subject line that summarizes the main point of the email. The subject should be professional and under 100 characters.',
      },
      {
        role: 'user',
        content: parts.join('\n\n'),
      },
    ],
    maxTokens: 50,
    temperature: 0.3,
    frequencyPenalty: 0.1,
    presencePenalty: 0.1,
    maxRetries: 1,
  });

  return text.trim();
};
