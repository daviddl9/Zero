import { streamText, tool, type UIMessageStreamWriter, type ToolSet } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

import { Tools } from '../../types';
import { env } from '../../env';
import { z } from 'zod';

/**
 * Orchestrator that handles the distinction between tools and agents.
 * Tools execute and return results, while agents stream responses directly.
 */
export class ToolOrchestrator {
  private writer: UIMessageStreamWriter;
  private streamingTools: Set<string> = new Set([Tools.WebSearch]);
  private connectionId: string;

  constructor(writer: UIMessageStreamWriter, connectionId: string) {
    this.writer = writer;
    this.connectionId = connectionId;
  }

  /**
   * Determines if a tool should be treated as an agent that streams
   */
  isStreamingTool(toolName: string): boolean {
    return this.streamingTools.has(toolName);
  }

  /**
   * Creates a streaming agent wrapper for tools that should stream responses directly
   */
  createStreamingAgent(toolName: string, originalTool: any) {
    if (!this.isStreamingTool(toolName)) {
      return originalTool;
    }

    // For webSearch, we want to stream the response directly without wrapping it as a tool result
    if (toolName === Tools.WebSearch) {
      return tool({
        description: 'Search the web for current information using Google Search grounding',
        inputSchema: z.object({
          query: z.string().describe('The query to search the web for'),
        }),
        execute: async ({ query }: { query: string }, { toolCallId: _toolCallId }: { toolCallId: string }) => {
          try {
            const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY });
            const response = streamText({
              model: google('gemini-3-flash-preview'),
              tools: {
                google_search: google.tools.googleSearch({}),
              },
              system: 'Be precise and concise. Do not include sources in your response. Do not use markdown formatting in your response.',
              prompt: query,
              maxOutputTokens: 1024,
            });

            // Stream the response directly to the UI message stream
            this.writer.merge(response.toUIMessageStream());

            // Return a simple string result since the actual streaming happens above
            // Note: Don't return objects with 'type' property as it breaks the stream parser
            return `Web search completed for: ${query}`;
          } catch (error) {
            console.error('Error searching the web:', error);
            throw new Error('Failed to search the web');
          }
        },
      });
    }

    // InboxRag is no longer a streaming tool - it's handled in tools.ts
    // with automatic email content fetching

    return originalTool;
  }

  /**
   * Processes all tools and returns modified versions for streaming tools
   */
  processTools<T extends ToolSet>(tools: T): T {
    const processedTools = { ...tools };

    for (const [toolName, toolInstance] of Object.entries(tools)) {
      if (this.isStreamingTool(toolName)) {
        processedTools[toolName as keyof T] = this.createStreamingAgent(toolName, toolInstance);
      }
    }

    return processedTools;
  }
}
