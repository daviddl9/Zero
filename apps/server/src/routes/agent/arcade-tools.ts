import { mcpRegistry } from '../../lib/mcp-providers';
import { connection } from '../../db/schema';
import { createDb } from '../../db';
import { eq } from 'drizzle-orm';
import { env } from '../../env';
import { tool } from 'ai';
import { z } from 'zod';

export const getArcadeTools = async (userId: string): Promise<Record<string, any>> => {
  await mcpRegistry.initialize(env);
  const provider = mcpRegistry.getProvider('arcade');

  if (!provider) {
    console.log('[Arcade Tools] Provider not configured');
    return {};
  }

  try {
    const tools = await provider.listTools(userId);

    const toolsMap: Record<string, any> = {};

    for (const mcpTool of tools) {
      const toolKey = `arcade_${mcpTool.category}_${mcpTool.name}`.replace(/[^a-zA-Z0-9_]/g, '_');

      toolsMap[toolKey] = tool({
        description: mcpTool.description,
        parameters: mcpTool.inputSchema as z.ZodTypeAny,
        execute: async (params) => {
          const result = await provider.executeTool(mcpTool.qualifiedName || mcpTool.name, params, {
            userId,
          });

          if (result && typeof result === 'object' && 'content' in result) {
            return result;
          }

          return {
            content: [
              {
                type: 'text' as const,
                text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
              },
            ],
          };
        },
      });
    }

    console.log(`[Arcade Tools] Loaded ${Object.keys(toolsMap).length} tools for user ${userId}`);
    return toolsMap;
  } catch (error) {
    console.error('[Arcade Tools] Error loading tools:', error);
    return {};
  }
};

export const getArcadeToolsForConnection = async (
  connectionId: string,
): Promise<Record<string, any>> => {
  try {
    const { db, conn } = createDb(env.HYPERDRIVE.connectionString);

    const connectionData = await db.query.connection.findFirst({
      where: eq(connection.id, connectionId),
    });

    await conn.end();

    if (!connectionData) {
      console.error('[Arcade Tools] Connection not found:', connectionId);
      return {};
    }

    return await getArcadeTools(connectionData.userId);
  } catch (error) {
    console.error('[Arcade Tools] Error getting tools for connection:', error);
    return {};
  }
};
