import { generateText, tool } from 'ai';
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
        const tools = {
            search_past_emails: tool({
                description: 'Search past emails with the recipient to understand context and writing style',
                parameters: z.object({
                    recipientEmail: z.string().describe('The email address of the recipient'),
                }),
                execute: async ({ recipientEmail: llmRecipient }) => {
                    try {
                        const recipientEmail = context.recipientEmail || llmRecipient;
                        if (!recipientEmail) {
                            steps.push('No recipient email provided, skipping past email search.');
                            return [];
                        }
                        steps.push(`Searching past emails with ${recipientEmail}...`);
                        return await searchPastEmails(recipientEmail, this.connectionId, this.userEmail);
                    } catch (error) {
                        console.error('[search_past_emails] Tool failed:', error);
                        return [];
                    }
                }
            })
        };

        const result = await generateText({
            model: google('gemini-3-flash-preview'),
            tools,
            maxSteps: 5,
            onStepFinish: (step) => {
                if (step.text) {
                    steps.push(step.text);
                }
            },
            system: `You are an expert email drafting assistant.
            Your goal is to draft 2 distinct email options for the user.

            WORKFLOW:
            1. If no specific instructions (userPoints) are provided, you MUST search for past emails with the recipient to understand the context and the user's writing style.
            2. Analyze the retrieved emails (if any) to identify:
               - Tone (formal, casual, etc.)
               - Greeting and sign-off style
               - Typical sentence structure and length
            3. Determine the 2 most logical next courses of action based on the context (e.g., Accept vs. Decline, Answer Question vs. Ask for Clarification, Propose Time A vs. Propose Time B).
            4. Draft 2 distinct options corresponding to these courses of action:
               - Option 1: Draft for Course of Action A.
               - Option 2: Draft for Course of Action B.

            STYLE REPLICATION:
            - Closely examine 'direction: sent' emails in the search results. These represent the user's voice.
            - Mimic the user's vocabulary, formatting habits (e.g., lowercase-only, heavy use of bullet points), and typical email length.
            - If no sent emails are found, default to a professional yet concise tone.

            If userPoints are provided, prioritize them but still maintain the user's inferred writing style.

            RECIPIENT SUGGESTIONS:
            - If the context suggests involving others (e.g., "loop in the team", "forward to manager", "cc my boss"), suggest recipients in the "to" or "cc" fields.
            - Extract email addresses from search results when available.
            - "to" = primary recipients who need to act on the email.
            - "cc" = people who should be informed but don't need to act.
            - Leave these fields empty or omit them if no recipient changes are needed.

            OUTPUT FORMAT:
            You must output a JSON object with a 'drafts' array containing exactly 2 draft objects.
            Each draft object must have:
            - "approach": A short label describing this response approach (e.g., "Accept invitation", "Decline politely")
            - "body": The complete email body text
            - "subject": (optional) A new subject line if appropriate
            - "to": (optional) Array of email addresses to add as To recipients
            - "cc": (optional) Array of email addresses to add as Cc recipients

            Example: { "drafts": [
              { "approach": "Accept meeting", "body": "Hi...", "to": [], "cc": [] },
              { "approach": "Decline meeting", "body": "Hello...", "cc": ["manager@example.com"] }
            ] }
            `,
            prompt: `Draft an email${context.recipientEmail ? ` to ${context.recipientEmail}` : ''}. ${
              context.userPoints
                ? `The user wants to: ${context.userPoints}`
                : 'No specific instructions provided, infer from past email context.'
            }`,
        });

        try {
            const cleanText = result.text.replace(/```json\n?|\n?```/g, '').trim();
            const parsed = JSON.parse(cleanText);
            const validated = DraftsResponseSchema.parse(parsed);
            return { drafts: validated.drafts, steps };
        } catch (error) {
            console.error('[DraftingAgent] Failed to parse response:', result.text, error);
            // Fallback: treat the raw text as a single draft body
            const fallbackDraft: DraftResponse = {
                approach: 'Generated response',
                body: result.text.trim(),
            };
            return { drafts: [fallbackDraft, fallbackDraft], steps };
        }
    }
}