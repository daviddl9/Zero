import { generateText, tool } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { searchPastEmails } from '../../services/agent-tools';

const DraftsResponseSchema = z.object({
  drafts: z.array(z.string()).length(2),
});

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
                execute: async ({ recipientEmail }) => {
                    try {
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
            model: google('gemini-2.0-flash'),
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
            
            You must output the final result as a JSON object with a 'drafts' array containing exactly 2 strings.
            Example: { "drafts": ["Hi...", "Hello..."] }
            `,
            prompt: `Draft an email to ${context.recipientEmail || 'unknown'}. ${context.userPoints ? 'User points: ' + context.userPoints : 'No specific points provided, infer from context.'}`,
        });

        try {
            const cleanText = result.text.replace(/```json\n?|\n?```/g, '').trim();
            const parsed = JSON.parse(cleanText);
            const validated = DraftsResponseSchema.parse(parsed);
            return { ...validated, steps };
        } catch (error) {
            console.error('[DraftingAgent] Failed to parse response:', result.text, error);
            return { drafts: [result.text.trim(), result.text.trim()], steps };
        }
    }
}