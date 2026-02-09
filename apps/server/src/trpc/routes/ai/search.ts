import {
  GmailSearchAssistantSystemPrompt,
  OutlookSearchAssistantSystemPrompt,
} from '../../../lib/prompts';
import { resolveAIClient, getSummarizationModel } from '../../../lib/ai-client-resolver';
import { activeDriverProcedure } from '../../trpc';
import { generateObject } from 'ai';
import { env } from '../../../env';
import { z } from 'zod';

export const generateSearchQuery = activeDriverProcedure
  .input(z.object({ query: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const {
      activeConnection: { providerId },
    } = ctx;
    const systemPrompt =
      providerId === 'google'
        ? GmailSearchAssistantSystemPrompt()
        : providerId === 'microsoft'
          ? OutlookSearchAssistantSystemPrompt()
          : '';

    const aiConfig = await resolveAIClient(ctx.sessionUser.id, env);
    const model = getSummarizationModel(aiConfig);

    const result = await generateObject({
      model,
      system: systemPrompt,
      prompt: input.query,
      schema: z.object({
        query: z.string(),
      }),
      output: 'object',
    });

    return result.object;
  });
