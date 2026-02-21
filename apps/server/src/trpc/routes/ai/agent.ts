import { activeConnectionProcedure, router } from '../../trpc';
import { getThread } from '../../../lib/server-utils';
import { z } from 'zod';
import { DraftingAgent } from '../../../lib/agents/drafting-agent';

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

            // Fetch current thread if replying
            let currentThread: Array<{ from: string; fromName: string; body: string; subject: string; date: string }> | undefined;
            if (input.threadId) {
                try {
                    const { result } = await getThread(activeConnection.id, input.threadId);
                    if (result?.messages) {
                        currentThread = result.messages.map(m => ({
                            from: m.sender.email || '',
                            fromName: m.sender.name || '',
                            body: m.decodedBody?.slice(0, 3000) || '',
                            subject: m.subject || '',
                            date: m.receivedOn || '',
                        }));
                    }
                } catch (error) {
                    console.error('[agentRouter] Failed to fetch thread:', error);
                }
            }

            const agent = new DraftingAgent(activeConnection.id, activeConnection.email);
            const result = await agent.generateDrafts({
                ...input,
                currentThread,
            });
            return result;
        }),
});
