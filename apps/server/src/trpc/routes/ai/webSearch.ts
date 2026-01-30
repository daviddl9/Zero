import { activeDriverProcedure } from '../../trpc';
import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { z } from 'zod';

export const webSearch = activeDriverProcedure
  .input(z.object({ query: z.string() }))
  .mutation(async ({ input }) => {
    const result = streamText({
      model: google('gemini-3-flash-preview'),
      prompt: input.query,
      tools: {
        google_search: google.tools.googleSearch({}),
      },
    });
    return result.toTextStreamResponse();
  });
