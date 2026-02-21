import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import type { EmailResult } from '../../services/agent-tools';

const DraftSchema = z.object({
  approach: z.string().describe('Short label for this response approach (e.g., "Accept invitation", "Decline politely")'),
  body: z.string().describe('The complete email body'),
  subject: z.string().optional().describe('Optional new subject line'),
  to: z.array(z.string().email()).optional().describe('Additional To recipients to suggest'),
  cc: z.array(z.string().email()).optional().describe('CC recipients to suggest'),
});

const DraftsResponseSchema = z.object({
  drafts: z.array(DraftSchema).length(2),
});

export type DraftResponse = z.infer<typeof DraftSchema>;

interface ThreadMessage {
  from: string;
  fromName: string;
  body: string;
  subject: string;
  date: string;
}

export class DraftingAgent {
  async generateDrafts(context: {
    recipientEmail?: string;
    userPoints?: string;
    subject?: string;
    currentThread?: ThreadMessage[];
    pastEmails?: EmailResult[];
  }) {
    const pastEmails = context.pastEmails ?? [];

    const pastEmailContext = pastEmails.length > 0
      ? `\n\nPAST EMAILS WITH RECIPIENT:\n${pastEmails.map((e, i) => `--- Email ${i + 1} (${e.direction}) ---\nFrom: ${e.from}\nTo: ${e.to.join(', ')}\nDate: ${e.date}\nSubject: ${e.subject}\nBody: ${e.body}\n`).join('\n')}`
      : '\n\nNo past emails found with this recipient.';

    const threadContext = context.currentThread?.length
      ? `\n\nCURRENT EMAIL THREAD (you are drafting a reply to this):\nSubject: ${context.subject || context.currentThread[0]?.subject || ''}\n${context.currentThread.map((m, i) => `--- Message ${i + 1} ---\nFrom: ${m.fromName ? `${m.fromName} <${m.from}>` : m.from}\nDate: ${m.date}\n${m.body}\n`).join('\n')}`
      : '';

    const result = await generateText({
      model: google('gemini-3-flash-preview'),
      system: `You are an expert email drafting assistant.
Your goal is to draft 2 distinct email options for the user.

WORKFLOW:
1. Analyze the provided context to understand the conversation and identify the user's writing style.
2. Determine the 2 most logical next courses of action based on the context (e.g., Accept vs. Decline, Answer Question vs. Ask for Clarification, Propose Time A vs. Propose Time B).
3. Draft 2 distinct options corresponding to these courses of action.

STYLE REPLICATION:
- Examine 'direction: sent' emails in PAST EMAILS WITH RECIPIENT to learn the user's
  natural voice and recipient-specific tone.
- Mimic the user's vocabulary, formatting habits (e.g., lowercase-only, heavy use of bullet points),
  greeting/sign-off style, and typical email length.
- If no sent emails are found, default to a professional yet concise tone.

REPLYING TO THREAD:
- If a CURRENT EMAIL THREAD is provided, you are drafting a REPLY.
- Read the thread carefully and draft a response that naturally continues the conversation.
- Address the specific points raised in the most recent message.
- Match the formality level of the thread.

If userPoints are provided, prioritize them but still maintain the user's inferred writing style.

RECIPIENT SUGGESTIONS:
- If the context suggests involving others (e.g., "loop in the team", "forward to manager", "cc my boss"), suggest recipients in the "to" or "cc" fields.
- Extract email addresses from the past emails when available.
- "to" = primary recipients who need to act on the email.
- "cc" = people who should be informed but don't need to act.
- Leave these fields empty or omit them if no recipient changes are needed.

OUTPUT FORMAT:
You must output ONLY a JSON object (no markdown, no code fences) with a 'drafts' array containing exactly 2 draft objects.
Each draft object must have:
- "approach": A short label describing this response approach (e.g., "Accept invitation", "Decline politely")
- "body": The complete email body text
- "subject": (optional) A new subject line if appropriate
- "to": (optional) Array of email addresses to add as To recipients
- "cc": (optional) Array of email addresses to add as Cc recipients

Example: { "drafts": [
  { "approach": "Accept meeting", "body": "Hi..." },
  { "approach": "Decline meeting", "body": "Hello...", "cc": ["manager@example.com"] }
] }`,
      prompt: `Draft an email${context.recipientEmail ? ` to ${context.recipientEmail}` : ''}. ${
        context.userPoints
          ? `The user wants to: ${context.userPoints}`
          : 'No specific instructions provided, infer from past email context.'
      }${threadContext}${pastEmailContext}`,
    });

    try {
      const cleanText = result.text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanText);
      const validated = DraftsResponseSchema.parse(parsed);
      return { drafts: validated.drafts, steps: [] };
    } catch (error) {
      console.error('[DraftingAgent] Failed to parse response:', JSON.stringify(result.text).substring(0, 500), error);
      const fallbackDraft: DraftResponse = {
        approach: 'Generated response',
        body: result.text.trim(),
      };
      return { drafts: [fallbackDraft, fallbackDraft], steps: [] };
    }
  }
}
