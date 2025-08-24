import type { z } from 'zod';

// Import the AI SDK v5 schemas
import { coreMessageSchema, modelMessageSchema } from 'ai';

// Define message types based on the schema structure
type CoreMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  providerOptions?: Record<string, Record<string, unknown>>;
};

type ModelMessage = CoreMessage;

// Define ToolSet type since it's not exported from AI SDK v5
type ToolSet = Record<string, { execute?: Function }>;

// Approval string to be shared across frontend and backend
export const APPROVAL = {
  YES: 'YES',
  NO: 'NO',
} as const;

// Type for tool execution functions
type ToolExecutionFunction = (
  args: Record<string, unknown>,
  context: { messages: CoreMessage[]; toolCallId: string },
) => Promise<unknown>;

// Convert old AI SDK v4 messages to AI SDK v5 format
export function convertOldMessagesToAIv5(messages: Array<{ role: string; content?: string; parts?: Array<{ type: string; text?: string; toolCallId?: string; toolName?: string; args?: unknown }> }>): CoreMessage[] {
  return messages
    .filter(message => {
      // Filter out messages with role 'data' as they're not supported in AI SDK v5
      return message.role !== 'data';
    })
    .map(message => {
      let content = '';

      if (message.content) {
        // If content is already a string, use it
        content = message.content;
      } else if (message.parts && Array.isArray(message.parts)) {
        // Convert old parts format to content string
        content = message.parts
          .map(part => {
            if (part.type === 'text' && part.text) {
              return part.text;
            } else if (part.type === 'tool' && part.toolCallId && part.toolName) {
              // Convert tool call to JSON string
              return JSON.stringify({
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                args: part.args || {},
              });
            }
            return '';
          })
          .filter(text => text !== '')
          .join('\n');
      }

      return {
        role: message.role as 'system' | 'user' | 'assistant' | 'tool',
        content,
      };
    });
}

export async function processToolCalls<
  Tools extends ToolSet,
  ExecutableTools extends {
    [Tool in keyof Tools as Tools[Tool] extends { execute: Function } ? never : Tool]: Tools[Tool];
  },
>(
  {
    dataStream,
    messages,
  }: {
    tools: Tools; // used for type inference
    dataStream: WritableStreamDefaultWriter;
    messages: CoreMessage[];
  },
  executeFunctions: {
    [K in keyof Tools & keyof ExecutableTools]?: ToolExecutionFunction;
  },
): Promise<CoreMessage[]> {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) return messages;

  // If the last message is not from the assistant, return as-is
  if (lastMessage.role !== 'assistant') return messages;

  // Process tool calls in the last message
  const processedMessages = [...messages];

  // For AI SDK v5, we need to check if the message contains tool calls
  // Since AI SDK v5 has a simple structure, we'll need to parse the content
  // to identify tool calls and their results

  // Check if the last message contains tool call information
  if (typeof lastMessage.content === 'string' &&
    (lastMessage.content.includes('toolCallId') || lastMessage.content.includes('toolName'))) {
    try {
      // Try to parse the content as JSON to extract tool call information
      const toolCallData = JSON.parse(lastMessage.content);

      if (toolCallData.toolCallId && toolCallData.toolName) {
        const toolName = toolCallData.toolName;
        const toolCallId = toolCallData.toolCallId;

        // Check if we have an execution function for this tool
        if (toolName in executeFunctions && executeFunctions[toolName as keyof typeof executeFunctions]) {
          const toolInstance = executeFunctions[toolName as keyof typeof executeFunctions]!;

          // Execute the tool with the parsed arguments
          const args = toolCallData.args || {};
          const result = await toolInstance(args, {
            messages: processedMessages,
            toolCallId,
          });

          // Create a tool result message
          const toolResultMessage: CoreMessage = {
            role: 'tool',
            content: JSON.stringify({
              toolCallId,
              toolName,
              result,
            }),
          };

          processedMessages.push(toolResultMessage);
        }
      }
    } catch (error) {
      // If parsing fails, the message might not contain tool calls
      // or might be in a different format - return as-is
      console.warn('Failed to parse tool call from message content:', error);
    }
  }

  return processedMessages;
}

export function getToolsRequiringConfirmation<
  T extends ToolSet,
// E extends {
//   [K in keyof T as T[K] extends { execute: Function } ? never : K]: T[K];
// },
>(tools: T): string[] {
  return (Object.keys(tools) as (keyof T)[]).filter((key) => {
    const maybeTool = tools[key];
    return typeof maybeTool?.execute !== 'function';
  }) as string[];
}
