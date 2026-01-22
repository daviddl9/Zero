import { generateText, tool } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { searchPastEmails, checkCalendar } from '../../services/agent-tools';

export class DraftingAgent {
    constructor(private connectionId: string) {}

    async generateDrafts(context: { recipientEmail?: string, userPoints?: string }) {
        const tools = {
            search_past_emails: tool({
                description: 'Search past emails with the recipient to understand context and writing style',
                parameters: z.object({
                    recipientEmail: z.string().describe('The email address of the recipient'),
                }),
                execute: async ({ recipientEmail }) => {
                    return await searchPastEmails(recipientEmail, this.connectionId);
                }
            }),
            check_calendar: tool({
                description: 'Check availability for a given date/time',
                parameters: z.object({
                    date: z.string().describe('The date to check availability for'),
                }),
                execute: async ({ date }) => {
                    return await checkCalendar(date);
                }
            })
        };

        const result = await generateText({
            model: google('gemini-2.0-flash'),
            tools,
            maxSteps: 5,
            system: `You are an expert email drafting assistant. 
            Your goal is to draft 2 distinct email options for the user.
            
            If the user provided points, use them.
            If not, use past emails to infer context and style.
            
            You must output the final result as a JSON object with a 'drafts' array containing 2 strings.
            Example: { "drafts": ["Hi...", "Hello..."] }
            `,
            prompt: `Draft an email to ${context.recipientEmail || 'unknown'}. ${context.userPoints ? 'User points: ' + context.userPoints : 'No specific points provided, infer from context.'}`,
        });

        try {
            const cleanText = result.text.replace(/```json\n?|\n?```/g, '').trim();
            return JSON.parse(cleanText);
        } catch {
            console.error('Failed to parse agent response as JSON:', result.text);
            return { drafts: [result.text, ""] };
        }
    }
}