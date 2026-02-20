import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { searchPastEmails } from '../../services/agent-tools';

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

export class DraftingAgent {
  constructor(
    private connectionId: string,
    private userEmail: string
  ) {}

  async generateDrafts(context: { recipientEmail?: string, userPoints?: string }) {
    const steps: string[] = [];

    // Search past emails directly instead of via LLM tool use
    let pastEmails: Awaited<ReturnType<typeof searchPastEmails>> = [];
    if (context.recipientEmail) {
      try {
        steps.push(`Searching past emails with ${context.recipientEmail}...`);
        pastEmails = await searchPastEmails(context.recipientEmail, this.connectionId, this.userEmail);
        steps.push(`Found ${pastEmails.length} past emails for context.`);
      } catch (error) {
        console.error('[DraftingAgent] searchPastEmails failed:', error);
        steps.push('Past email search failed, proceeding without context.');
      }
    } else {
      steps.push('No recipient email provided, skipping past email search.');
    }

    const pastEmailContext = pastEmails.length > 0
      ? `\n\nPAST EMAILS WITH RECIPIENT:\n${pastEmails.map((e, i) => `--- Email ${i + 1} (${e.direction}) ---\nFrom: ${e.from}\nTo: ${e.to.join(', ')}\nDate: ${e.date}\nSubject: ${e.subject}\nBody: ${e.body}\n`).join('\n')}`
      : '\n\nNo past emails found with this recipient.';

    const result = await generateText({
      model: google('gemini-2.5-flash'),
      system: `You are an expert email drafting assistant.
Your goal is to draft 2 distinct email options for the user.

WORKFLOW:
1. Analyze the provided past emails (if any) to identify:
   - Tone (formal, casual, etc.)
   - Greeting and sign-off style
   - Typical sentence structure and length
2. Determine the 2 most logical next courses of action based on the context (e.g., Accept vs. Decline, Answer Question vs. Ask for Clarification, Propose Time A vs. Propose Time B).
3. Draft 2 distinct options corresponding to these courses of action:
   - Option 1: Draft for Course of Action A.
   - Option 2: Draft for Course of Action B.

STYLE REPLICATION:
- Closely examine 'direction: sent' emails in the context. These represent the user's voice.
- Mimic the user's vocabulary, formatting habits (e.g., lowercase-only, heavy use of bullet points), and typical email length.
- If no sent emails are found, default to a professional yet concise tone.

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
      }${pastEmailContext}`,
    });

    try {
      const cleanText = result.text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanText);
      const validated = DraftsResponseSchema.parse(parsed);
      return { drafts: validated.drafts, steps };
    } catch (error) {
      console.error('[DraftingAgent] Failed to parse response:', JSON.stringify(result.text).substring(0, 500), error);
      const fallbackDraft: DraftResponse = {
        approach: 'Generated response',
        body: result.text.trim(),
      };
      return { drafts: [fallbackDraft, fallbackDraft], steps };
    }
  }
}
