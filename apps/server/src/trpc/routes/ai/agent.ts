import { activeConnectionProcedure, router } from '../../trpc';
import { z } from 'zod';
import { DraftingAgent } from '../../../lib/agents/drafting-agent';

export const agentRouter = router({
    generateDrafts: activeConnectionProcedure
        .input(z.object({
            recipientEmail: z.string().optional(),
            userPoints: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const { activeConnection } = ctx;
            const agent = new DraftingAgent(activeConnection.id, activeConnection.email);
            const result = await agent.generateDrafts(input);
            return result;
        }),
});