import { activeConnectionProcedure, router } from '../../trpc';
import { getThread } from '../../../lib/server-utils';
import { z } from 'zod';
import { DraftingAgent } from '../../../lib/agents/drafting-agent';
import { searchPastEmails } from '../../../services/agent-tools';

export const agentRouter = router({
    generateDrafts: activeConnectionProcedure
        .input(z.object({
            recipientEmail: z.string().optional(),
            userPoints: z.string().optional(),
            threadId: z.string().optional(),
            subject: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const { activeConnection } = ctx;

            // Fetch current thread and past emails in parallel
            const [currentThread, pastEmails] = await Promise.all([
                input.threadId
                    ? getThread(activeConnection.id, input.threadId)
                        .then(({ result }) =>
                            result?.messages?.map(m => ({
                                from: m.sender.email || '',
                                fromName: m.sender.name || '',
                                body: m.decodedBody?.slice(0, 3000) || '',
                                subject: m.subject || '',
                                date: m.receivedOn || '',
                            }))
                        )
                        .catch((error) => {
                            console.error('[agentRouter] Failed to fetch thread:', error);
                            return undefined;
                        })
                    : Promise.resolve(undefined),
                input.recipientEmail
                    ? searchPastEmails(input.recipientEmail, activeConnection.id, activeConnection.email)
                        .catch((error) => {
                            console.error('[agentRouter] Failed to fetch past emails:', error);
                            return [];
                        })
                    : Promise.resolve([]),
            ]);

            const agent = new DraftingAgent();
            const result = await agent.generateDrafts({
                ...input,
                currentThread,
                pastEmails,
            });
            return result;
        }),
});
