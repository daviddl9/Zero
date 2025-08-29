import { DynamicStructuredTool } from '@langchain/core/tools';
import { getArcadeAuthHandler } from './arcade-auth-handler';
import { arcadeConnection } from '../db/schema';
import Arcade from '@arcadeai/arcadejs';
import { eq } from 'drizzle-orm';
import { createDb } from '../db';
import { z } from 'zod';

type LangChainTool = DynamicStructuredTool;

export interface ArcadeToolsResult {
  tools: Record<string, LangChainTool>;
  authHandler: ReturnType<typeof getArcadeAuthHandler>;
}

/**
 * Load Arcade tools for a specific user with authorization handling
 *
 * Based on the authorization pattern from: https://docs.arcade.dev/home/langchain/user-auth-interrupts
 *
 * When a tool requires authorization:
 * 1. The tool execution returns a special response with needsAuth=true
 * 2. The response includes an authUrl for the user to authorize
 * 3. The frontend can display this URL to the user
 * 4. Once authorized, the tool can be executed normally
 */
export async function loadUserArcadeTools(
  userId: string,
  connectionString: string,
  arcadeApiKey?: string,
): Promise<ArcadeToolsResult> {
  if (!arcadeApiKey) {
    console.warn('[loadUserArcadeTools] No Arcade API key configured');
    return {
      tools: {},
      authHandler: getArcadeAuthHandler(''),
    };
  }

  const arcade = new Arcade({
    apiKey: arcadeApiKey,
  });

  const authHandler = getArcadeAuthHandler(arcadeApiKey);
  const { db, conn } = createDb(connectionString);

  try {
    const connections = await db.query.arcadeConnection.findMany({
      where: eq(arcadeConnection.userId, userId),
    });

    if (connections.length === 0) {
      console.log(`[loadUserArcadeTools] No Arcade connections found for user ${userId}`);
      return { tools: {}, authHandler };
    }

    const toolkits = connections.map((c) => c.toolkit);
    console.log(`[loadUserArcadeTools] Loading tools for toolkits: ${toolkits.join(', ')}`);

    const allTools: Record<string, LangChainTool> = {};

    for (const connection of connections) {
      const toolkit = connection.toolkit;

      const toolDefinitions = getToolkitDefinitions(toolkit);

      for (const toolDef of toolDefinitions) {
        const toolkitMap: Record<string, string> = {
          github: 'GitHub',
          linear: 'Linear',
          stripe: 'Stripe',
        };
        const arcadeToolkit = toolkitMap[toolkit.toLowerCase()] || toolkit;
        const toolName = `${arcadeToolkit}.${toolDef.name}`;

        const langchainTool = new DynamicStructuredTool({
          name: toolName,
          description: toolDef.description,
          schema: toolDef.schema,
          func: async (input) => {
            try {
              console.log(`[loadUserArcadeTools] Executing ${toolName} with input:`, input);

              // First check if the tool needs authorization
              const authState = await authHandler.requiresAuth(toolName, userId);

              if (authState.status === 'pending') {
                // Return a special response indicating authorization is needed
                return JSON.stringify({
                  success: false,
                  needsAuth: true,
                  toolName,
                  authUrl: authState.authUrl,
                  authId: authState.authId,
                  message: `Tool ${toolName} requires authorization. Please visit: ${authState.authUrl}`,
                });
              }

              // Tool is authorized, execute it
              const response = await arcade.tools.execute({
                tool_name: toolName,
                input: input,
                user_id: userId,
              });

              return JSON.stringify(response.output?.value || response.output || response);
            } catch (error) {
              console.error(`[loadUserArcadeTools] Error executing tool ${toolName}:`, error);

              // Handle authorization errors
              if (error instanceof Error && error.message.toLowerCase().includes('auth')) {
                // Try to get auth URL
                const authState = await authHandler.requiresAuth(toolName, userId);
                return JSON.stringify({
                  success: false,
                  needsAuth: true,
                  toolName,
                  authUrl: authState.authUrl,
                  authId: authState.authId,
                  message: `Authorization required for ${toolName}`,
                });
              }

              throw error;
            }
          },
        });

        allTools[toolName] = langchainTool;
      }
    }

    console.log(`[loadUserArcadeTools] Total tools loaded: ${Object.keys(allTools).length}`);
    return { tools: allTools, authHandler };
  } catch (error) {
    console.error('[loadUserArcadeTools] Failed to load Arcade tools:', error);
    return { tools: {}, authHandler };
  } finally {
    await conn.end();
  }
}

function getToolkitDefinitions(toolkit: string) {
  const definitions: Record<
    string,
    Array<{ name: string; description: string; schema: z.ZodTypeAny }>
  > = {
    Gmail: [
      {
        name: 'SendEmail',
        description: 'Send an email using Gmail',
        schema: z.object({
          to: z.string().describe('Recipient email address'),
          subject: z.string().describe('Email subject'),
          body: z.string().describe('Email body'),
        }),
      },
      {
        name: 'SearchEmails',
        description: 'Search for emails in Gmail',
        schema: z.object({
          query: z.string().describe('Search query'),
          maxResults: z.number().optional().default(10).describe('Maximum number of results'),
        }),
      },
    ],
    GitHub: [
      {
        name: 'CreateIssue',
        description: 'Create a new issue in a GitHub repository',
        schema: z.object({
          owner: z.string().describe('Repository owner'),
          repo: z.string().describe('Repository name'),
          title: z.string().describe('Issue title'),
          body: z.string().describe('Issue body'),
        }),
      },
      {
        name: 'SetStarred',
        description: 'Star or unstar a GitHub repository',
        schema: z.object({
          owner: z.string().describe('Repository owner'),
          name: z.string().describe('Repository name'),
          starred: z.boolean().describe('Whether to star (true) or unstar (false)'),
        }),
      },
    ],
    Slack: [
      {
        name: 'PostMessage',
        description: 'Send a message to a Slack channel',
        schema: z.object({
          channel: z.string().describe('Channel name or ID'),
          text: z.string().describe('Message text'),
        }),
      },
    ],
    Notion: [
      {
        name: 'CreatePage',
        description: 'Create a new page in Notion',
        schema: z.object({
          title: z.string().describe('Page title'),
          content: z.string().describe('Page content'),
        }),
      },
    ],
    Linear: [
      {
        name: 'CreateIssue',
        description: 'Create a new issue in Linear',
        schema: z.object({
          title: z.string().describe('Issue title'),
          description: z.string().describe('Issue description'),
          priority: z.number().optional().describe('Priority (1-4)'),
        }),
      },
    ],
    Stripe: [
      {
        name: 'ListCustomers',
        description: 'List Stripe customers',
        schema: z.object({
          limit: z.number().optional().default(10).describe('Number of customers to return'),
        }),
      },
    ],
  };

  const toolkitMap: Record<string, string> = {
    github: 'GitHub',
    linear: 'Linear',
    stripe: 'Stripe',
  };

  const arcadeToolkit = toolkitMap[toolkit.toLowerCase()] || toolkit;
  return definitions[arcadeToolkit] || [];
}
