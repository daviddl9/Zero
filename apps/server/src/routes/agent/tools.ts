import { getCurrentDateContext, GmailSearchAssistantSystemPrompt } from '../../lib/prompts';
import { getThread, getZeroAgent } from '../../lib/server-utils';
import type { IGetThreadResponse } from '../../lib/driver/types';
import { composeEmail } from '../../trpc/routes/ai/compose';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { colors } from '../../lib/prompts';
import { openai } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';
import { Tools } from '../../types';
import { env } from '../../env';
import { z } from 'zod';

type ModelTypes = 'summarize' | 'general' | 'chat' | 'vectorize';

const models: Record<ModelTypes, any> = {
  summarize: '@cf/facebook/bart-large-cnn',
  general: 'llama-3.3-70b-instruct-fp8-fast',
  chat: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  vectorize: '@cf/baai/bge-large-en-v1.5',
};

export const getEmbeddingVector = async (
  text: string,
  gatewayId: 'vectorize-save' | 'vectorize-load',
) => {
  try {
    const embeddingResponse = await env.AI.run(
      models.vectorize,
      { text },
      {
        gateway: {
          id: gatewayId,
        },
      },
    );
    const embeddingVector = embeddingResponse.data[0];
    return embeddingVector ?? null;
  } catch (error) {
    console.log('[getEmbeddingVector] failed', error);
    return null;
  }
};

// const askZeroMailbox = (connectionId: string) =>
//   tool({
//     description: 'Ask Zero a question about the mailbox',
//     inputSchema: z.object({
//       question: z.string().describe('The question to ask Zero'),
//       topK: z.number().describe('The number of results to return').max(9).min(1).default(3),
//     }),
//     execute: async ({ question, topK = 3 }) => {
//       const embedding = await getEmbeddingVector(question, 'vectorize-load');
//       if (!embedding) {
//         return { error: 'Failed to get embedding' };
//       }
//       const threadResults = await env.VECTORIZE.query(embedding, {
//         topK,
//         returnMetadata: 'all',
//         filter: {
//           connection: connectionId,
//         },
//       });

//       if (!threadResults.matches.length) {
//         return {
//           response: [],
//           success: false,
//         };
//       }
//       return {
//         response: threadResults.matches.map((e) => e.metadata?.['summary'] ?? 'no content'),
//         success: true,
//       };
//     },
//   });

// const askZeroThread = (connectionId: string) =>
//   tool({
//     description: 'Ask Zero a question about a specific thread',
//     inputSchema: z.object({
//       threadId: z.string().describe('The ID of the thread to ask Zero about'),
//       question: z.string().describe('The question to ask Zero'),
//     }),
//     execute: async ({ threadId, question }) => {
//       const response = await env.VECTORIZE.getByIds([threadId]);
//       if (!response.length) return { response: "I don't know, no threads found", success: false };
//       const embedding = await getEmbeddingVector(question, 'vectorize-load');
//       if (!embedding) {
//         return { error: 'Failed to get embedding' };
//       }
//       const threadResults = await env.VECTORIZE.query(embedding, {
//         topK: 1,
//         returnMetadata: 'all',
//         filter: {
//           thread: threadId,
//           connection: connectionId,
//         },
//       });
//       const topThread = threadResults.matches[0];
//       if (!topThread) return { response: "I don't know, no threads found", success: false };
//       return {
//         response: topThread.metadata?.['summary'] ?? 'no content',
//         success: true,
//       };
//     },
//   });

/**
 * ⚠️  IMPORTANT
 * Do NOT return the full thread here – it bloats the conversation state and
 * may hit the 128 MB cap in Cloudflare Workers. We only hand back a lightweight
 * tag that the front-end can interpret.
 *
 * The tag format must be exactly: <thread id="{id}"/>
 */
const getEmail = () =>
  tool({
    description: 'Return a placeholder tag for a specific email thread by ID',
    inputSchema: z.object({
      id: z.string().describe('The ID of the email thread to retrieve'),
    }),
    execute: async ({ id }) => {
      /* nothing to fetch server-side any more */
      return `<thread id="${id}"/>`;
    },
  });

/**
 * Read the full content of an email thread by ID.
 * Returns the actual email messages with subject, body, sender, and date.
 * Use this when you need to read and understand email content to answer questions.
 */
const readFullThread = (connectionId: string) =>
  tool({
    description:
      'Read the full content of an email thread by ID. Use this to read actual email content when you need to answer questions about specific emails or conversations.',
    inputSchema: z.object({
      threadId: z.string().describe('The ID of the thread to read'),
      maxMessages: z
        .number()
        .optional()
        .default(10)
        .describe('Maximum number of messages to return from the thread'),
    }),
    execute: async ({ threadId, maxMessages = 10 }) => {
      try {
        const { result: thread } = await getThread(connectionId, threadId);
        if (!thread?.messages || thread.messages.length === 0) {
          return { error: 'Thread not found or has no messages' };
        }

        const messages = thread.messages.slice(0, maxMessages).map((message) => ({
          subject: message.subject || '',
          body: message.decodedBody?.slice(0, 2000) || '', // Limit body to prevent bloat
          from: message.sender?.email || '',
          fromName: message.sender?.name || '',
          to: message.to?.map((t) => t.email) || [],
          cc: message.cc?.map((c) => c.email) || [],
          date: message.receivedOn || '',
        }));

        return {
          threadId,
          subject: thread.latest?.subject || messages[0]?.subject || '',
          messageCount: thread.messages.length,
          messages,
        };
      } catch (error) {
        console.error('[readFullThread] Error:', error);
        return { error: 'Failed to read thread' };
      }
    },
  });

const getThreadSummary = (connectionId: string) =>
  tool({
    description: 'Get the summary of a specific email thread',
    inputSchema: z.object({
      id: z.string().describe('The ID of the email thread to get the summary of'),
    }),
    execute: async ({ id }) => {
      try {
        let thread: IGetThreadResponse | null = null;
        try {
          const { result } = await getThread(connectionId, id);
          thread = result;
        } catch (error) {
          console.error('[getThreadSummary] Error getting thread', error);
          return { error: 'Thread not found' };
        }

        // Try to get vectorize summary if available
        let vectorizeResponse: any[] = [];
        try {
          vectorizeResponse = await env.VECTORIZE.getByIds([id]);
        } catch (error) {
          console.error('[getThreadSummary] VECTORIZE not available:', error);
          // Continue without vectorize summary
        }

        if (
          vectorizeResponse.length &&
          vectorizeResponse?.[0]?.metadata?.['summary'] &&
          thread?.latest?.subject
        ) {
          const result = vectorizeResponse[0].metadata as { summary: string; connection: string };
          if (result.connection !== connectionId) {
            return null;
          }
          try {
            const shortResponse = await env.AI.run('@cf/facebook/bart-large-cnn', {
              input_text: result.summary,
            });
            return {
              short: shortResponse.summary,
              subject: thread.latest?.subject,
              sender: thread.latest?.sender,
              date: thread.latest?.receivedOn,
            };
          } catch (aiError) {
            console.error('[getThreadSummary] AI summarization failed:', aiError);
            // Fall through to return basic info
          }
        }

        return {
          subject: thread?.latest?.subject,
          sender: thread?.latest?.sender,
          date: thread?.latest?.receivedOn,
        };
      } catch (error) {
        console.error('[getThreadSummary] Unexpected error:', error);
        return { error: 'Failed to get thread summary' };
      }
    },
  });

const composeEmailTool = (connectionId: string) =>
  tool({
    description: 'Compose an email using AI assistance',
    inputSchema: z.object({
      prompt: z.string().describe('The prompt or rough draft for the email'),
      emailSubject: z.string().optional().describe('The subject of the email'),
      to: z.array(z.string()).optional().describe('Recipients of the email'),
      cc: z.array(z.string()).optional().describe('CC recipients of the email'),
      threadMessages: z
        .array(
          z.object({
            from: z.string().describe('The sender of the email'),
            to: z.array(z.string()).describe('The recipients of the email'),
            cc: z.array(z.string()).optional().describe('The CC recipients of the email'),
            subject: z.string().describe('The subject of the email'),
            body: z.string().describe('The body of the email'),
          }),
        )
        .optional()
        .describe('Previous messages in the thread for context'),
    }),
    execute: async (data) => {
      const newBody = await composeEmail({
        ...data,
        username: 'AI Assistant',
        connectionId,
      });
      return { newBody };
    },
  });

// const listEmails = (connectionId: string) =>
//   tool({
//     description: 'List emails in a specific folder',
//     inputSchema: z.object({
//       folder: z.string().describe('The folder to list emails from').default('inbox'),
//       maxResults: z
//         .number()
//         .optional()
//         .describe('The maximum number of results to return')
//         .default(5),
//       labelIds: z.array(z.string()).optional().describe('The labels to filter emails'),
//       pageToken: z.string().optional().describe('The page token to continue listing emails'),
//     }),
//     execute: async (params) => {
//       return await agent.list(params);
//     },
//   });

const markAsRead = (connectionId: string) =>
  tool({
    description: 'Mark emails as read',
    inputSchema: z.object({
      threadIds: z.array(z.string()).describe('The IDs of the threads to mark as read'),
    }),
    execute: async ({ threadIds }) => {
      const { stub: agent } = await getZeroAgent(connectionId);
      await Promise.all(
        threadIds.map((threadId) => agent.modifyThreadLabelsInDB(threadId, [], ['UNREAD'])),
      );
      return { threadIds, success: true };
    },
  });

const markAsUnread = (connectionId: string) =>
  tool({
    description: 'Mark emails as unread',
    inputSchema: z.object({
      threadIds: z.array(z.string()).describe('The IDs of the threads to mark as unread'),
    }),
    execute: async ({ threadIds }) => {
      const { stub: agent } = await getZeroAgent(connectionId);
      await Promise.all(
        threadIds.map((threadId) => agent.modifyThreadLabelsInDB(threadId, ['UNREAD'], [])),
      );
      return { threadIds, success: true };
    },
  });

const modifyLabels = (connectionId: string) =>
  tool({
    description: 'Modify labels on emails',
    inputSchema: z.object({
      threadIds: z.array(z.string()).describe('The IDs of the threads to modify'),
      options: z.object({
        addLabels: z
          .array(z.string())
          .default([])
          .describe('The labels to add, an array of label names'),
        removeLabels: z
          .array(z.string())
          .default([])
          .describe('The labels to remove, an array of label names'),
      }),
    }),
    execute: async ({ threadIds, options }) => {
      const { stub: agent } = await getZeroAgent(connectionId);
      await Promise.all(
        threadIds.map((threadId) =>
          agent.modifyThreadLabelsInDB(threadId, options.addLabels, options.removeLabels),
        ),
      );
      return { threadIds, options, success: true };
    },
  });

const getUserLabels = (connectionId: string) =>
  tool({
    description: 'Get all user labels',
    inputSchema: z.object({}),
    execute: async () => {
      const { stub: agent } = await getZeroAgent(connectionId);
      return await agent.getUserLabels();
    },
  });

const sendEmail = (connectionId: string) =>
  tool({
    description: 'Send a new email',
    inputSchema: z.object({
      to: z.array(
        z.object({
          email: z.string().describe('The email address of the recipient'),
          name: z.string().optional().describe('The name of the recipient'),
        }),
      ),
      subject: z.string().describe('The subject of the email'),
      message: z.string().describe('The body of the email'),
      cc: z
        .array(
          z.object({
            email: z.string().describe('The email address of the recipient'),
            name: z.string().optional().describe('The name of the recipient'),
          }),
        )
        .optional(),
      bcc: z
        .array(
          z.object({
            email: z.string().describe('The email address of the recipient'),
            name: z.string().optional().describe('The name of the recipient'),
          }),
        )
        .optional(),
      threadId: z.string().optional().describe('The ID of the thread to send the email from'),
      // fromEmail: z.string().optional(),
      draftId: z.string().optional().describe('The ID of the draft to send'),
    }),
    execute: async (data) => {
      try {
        const { stub: agent } = await getZeroAgent(connectionId);
        const { draftId, ...mail } = data;

        if (draftId) {
          await agent.sendDraft(draftId, {
            ...mail,
            attachments: [],
            headers: {},
          });
        } else {
          await agent.create({
            ...mail,
            attachments: [],
            headers: {},
          });
        }

        return { success: true };
      } catch (error) {
        console.error('Error sending email:', error);
        throw new Error(
          'Failed to send email: ' + (error instanceof Error ? error.message : String(error)),
        );
      }
    },
  });

const createLabel = (connectionId: string) =>
  tool({
    description: 'Create a new label with custom colors, if it does nto exist already',
    inputSchema: z.object({
      name: z.string().describe('The name of the label to create'),
      backgroundColor: z
        .string()
        .describe('The background color of the label in hex format')
        .refine((color) => colors.includes(color), {
          message: 'Background color must be one of the predefined colors',
        }),
      textColor: z
        .string()
        .describe('The text color of the label in hex format')
        .refine((color) => colors.includes(color), {
          message: 'Text color must be one of the predefined colors',
        }),
    }),
    execute: async ({ name, backgroundColor, textColor }) => {
      const { stub: agent } = await getZeroAgent(connectionId);
      await agent.createLabel({ name, color: { backgroundColor, textColor } });
      return { name, backgroundColor, textColor, success: true };
    },
  });

const bulkDelete = (connectionId: string) =>
  tool({
    description: 'Move multiple emails to trash by adding the TRASH label',
    inputSchema: z.object({
      threadIds: z.array(z.string()).describe('Array of email IDs to move to trash'),
    }),
    execute: async ({ threadIds }) => {
      const { stub: agent } = await getZeroAgent(connectionId);
      await Promise.all(
        threadIds.map((threadId) => agent.modifyThreadLabelsInDB(threadId, ['TRASH'], [])),
      );
      return { threadIds, success: true };
    },
  });

const bulkArchive = (connectionId: string) =>
  tool({
    description: 'Move multiple emails to the archive by removing the INBOX label',
    inputSchema: z.object({
      threadIds: z.array(z.string()).describe('Array of email IDs to move to archive'),
    }),
    execute: async ({ threadIds }) => {
      const { stub: agent } = await getZeroAgent(connectionId);
      await Promise.all(
        threadIds.map((threadId) => agent.modifyThreadLabelsInDB(threadId, [], ['INBOX'])),
      );
      return { threadIds, success: true };
    },
  });

const deleteLabel = (connectionId: string) =>
  tool({
    description: "Delete a label from the user's account",
    inputSchema: z.object({
      id: z.string().describe('The ID of the label to delete'),
    }),
    execute: async ({ id }) => {
      const { stub: agent } = await getZeroAgent(connectionId);
      await agent.deleteLabel(id);
      return { id, success: true };
    },
  });

const buildGmailSearchQuery = () =>
  tool({
    description: 'Build a Gmail search query',
    inputSchema: z.object({
      query: z.string().describe('The search query to build, provided in natural language'),
    }),
    execute: async (params) => {
      console.log('[DEBUG] buildGmailSearchQuery', params);

      const result = await generateText({
        model: openai(env.OPENAI_MODEL || 'gpt-4o'),
        system: GmailSearchAssistantSystemPrompt(),
        prompt: params.query,
      });
      return {
        content: [
          {
            type: 'text',
            text: result.text,
          },
        ],
      };
    },
  });

const getCurrentDate = () =>
  tool({
    description: 'Get the current date',
    inputSchema: z.object({}).default({}),
    execute: async () => {
      console.log('[DEBUG] getCurrentDate');

      return {
        content: [
          {
            type: 'text',
            text: getCurrentDateContext(),
          },
        ],
      };
    },
  });

/**
 * Think tool - allows the model to reason step-by-step before taking action.
 * This helps with multi-step tool calling by giving the model a way to plan.
 */
const think = () =>
  tool({
    description:
      'Use this tool to think through complex problems step-by-step before taking action. Call this when you need to plan which tools to use next, especially after receiving tool results that require follow-up actions.',
    inputSchema: z.object({
      thought: z.string().describe('Your reasoning about what to do next'),
      nextAction: z.string().describe('The next action you plan to take (e.g., "call readFullThread to read email content")'),
    }),
    execute: async ({ thought, nextAction }) => {
      console.log('[Think] Reasoning:', thought);
      console.log('[Think] Next action:', nextAction);
      return {
        acknowledged: true,
        message: 'Continue with your planned action.',
      };
    },
  });

export const webSearch = () =>
  tool({
    description: 'Search the web for current information using Google Search grounding',
    inputSchema: z.object({
      query: z.string().describe('The query to search the web for'),
    }),
    execute: async ({ query }) => {
      try {
        const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY });
        const response = await generateText({
          model: google('gemini-3-flash-preview'),
          tools: {
            google_search: google.tools.googleSearch({}),
          },
          system: 'Be precise and concise. Do not include sources in your response. Do not use markdown formatting in your response.',
          prompt: query,
          maxOutputTokens: 1024,
        });

        return response.text;
      } catch (error) {
        console.error('Error searching the web:', error);
        throw new Error('Failed to search the web');
      }
    },
  });

/**
 * Search past emails with specific recipients to understand communication style and relationship.
 * Returns both sent and received emails to understand the full conversation context.
 */
export const searchEmails = (connectionId: string) =>
  tool({
    description:
      'Search past emails exchanged with specific recipients to understand your communication style and relationship with them. Use this to discern formality level, tone, typical greetings/sign-offs, and relationship context.',
    inputSchema: z.object({
      recipientEmails: z.array(z.string()).describe('Email addresses to find conversations with'),
      maxResults: z.number().optional().default(10).describe('Maximum number of emails to return'),
      sentOnly: z
        .boolean()
        .optional()
        .default(false)
        .describe('If true, only return emails sent BY the user'),
    }),
    execute: async ({ recipientEmails, maxResults = 10, sentOnly = false }) => {
      try {
        const { stub: agent } = await getZeroAgent(connectionId);

        // Build search query for conversations with these recipients
        const recipientQueries = recipientEmails.map((email) => {
          if (sentOnly) {
            return `from:me to:${email}`;
          }
          return `(from:me to:${email}) OR (from:${email} to:me)`;
        });
        const query = recipientQueries.join(' OR ');

        // Search for matching threads
        const searchResult = await agent.searchThreads({
          query,
          maxResults: maxResults * 2, // Get more threads since we'll filter
          folder: 'all mail',
        });

        if (!searchResult.threadIds.length) {
          return [];
        }

        // Fetch thread details for each result
        const emails: Array<{
          subject: string;
          body: string;
          date: string;
          to: string[];
          from: string;
          direction: 'sent' | 'received';
        }> = [];

        for (const threadId of searchResult.threadIds.slice(0, maxResults)) {
          try {
            const { result: thread } = await getThread(connectionId, threadId);
            if (thread?.messages) {
              for (const message of thread.messages) {
                const isSent =
                  message.sender.email &&
                  !recipientEmails.some(
                    (r) => r.toLowerCase() === message.sender.email.toLowerCase(),
                  );

                if (sentOnly && !isSent) continue;

                emails.push({
                  subject: message.subject || '',
                  body: message.decodedBody?.slice(0, 1000) || '', // Limit body length
                  date: message.receivedOn || '',
                  to: message.to?.map((t) => t.email) || [],
                  from: message.sender.email || '',
                  direction: isSent ? 'sent' : 'received',
                });

                if (emails.length >= maxResults) break;
              }
            }
          } catch (error) {
            console.error(`[searchEmails] Error fetching thread ${threadId}:`, error);
          }
          if (emails.length >= maxResults) break;
        }

        return emails;
      } catch (error) {
        console.error('[searchEmails] Error:', error);
        return [];
      }
    },
  });

/**
 * Search past emails by keyword to find similar topics, situations, or requests.
 * Useful for understanding how the user has responded to similar situations before.
 */
export const searchSimilarEmails = (connectionId: string) =>
  tool({
    description:
      'Search past emails by keyword to find similar topics, situations, or requests. Use this to understand how the user has responded to similar situations before.',
    inputSchema: z.object({
      keywords: z.array(z.string()).describe('Keywords to search for similar emails/topics'),
      maxResults: z.number().optional().default(5).describe('Maximum number of emails to return'),
      sentOnly: z
        .boolean()
        .optional()
        .default(true)
        .describe('Only return emails sent BY the user (for style matching)'),
    }),
    execute: async ({ keywords, maxResults = 5, sentOnly = true }) => {
      try {
        const { stub: agent } = await getZeroAgent(connectionId);

        // Build search query from keywords
        const keywordQuery = keywords.join(' OR ');
        const query = sentOnly ? `from:me (${keywordQuery})` : keywordQuery;

        // Search for matching threads
        const searchResult = await agent.searchThreads({
          query,
          maxResults: maxResults * 2,
          folder: 'all mail',
        });

        if (!searchResult.threadIds.length) {
          return [];
        }

        // Fetch thread details for each result
        const emails: Array<{
          subject: string;
          body: string;
          date: string;
          to: string[];
          from: string;
        }> = [];

        for (const threadId of searchResult.threadIds.slice(0, maxResults)) {
          try {
            const { result: thread } = await getThread(connectionId, threadId);
            if (thread?.messages) {
              for (const message of thread.messages) {
                // If sentOnly, filter to only user's sent messages by checking tags
                if (sentOnly) {
                  const isSent = message.tags?.some(
                    (tag) => tag.id === 'SENT' || tag.name?.toUpperCase() === 'SENT',
                  );
                  if (!isSent) continue;
                }

                emails.push({
                  subject: message.subject || '',
                  body: message.decodedBody?.slice(0, 1000) || '', // Limit body length
                  date: message.receivedOn || '',
                  to: message.to?.map((t) => t.email) || [],
                  from: message.sender.email || '',
                });

                if (emails.length >= maxResults) break;
              }
            }
          } catch (error) {
            console.error(`[searchSimilarEmails] Error fetching thread ${threadId}:`, error);
          }
          if (emails.length >= maxResults) break;
        }

        return emails;
      } catch (error) {
        console.error('[searchSimilarEmails] Error:', error);
        return [];
      }
    },
  });

export const tools = async (connectionId: string) => {
  return {
    [Tools.GetThread]: getEmail(),
    [Tools.GetThreadSummary]: getThreadSummary(connectionId),
    [Tools.ReadFullThread]: readFullThread(connectionId),
    [Tools.ComposeEmail]: composeEmailTool(connectionId),
    [Tools.MarkThreadsRead]: markAsRead(connectionId),
    [Tools.MarkThreadsUnread]: markAsUnread(connectionId),
    [Tools.ModifyLabels]: modifyLabels(connectionId),
    [Tools.GetUserLabels]: getUserLabels(connectionId),
    [Tools.SendEmail]: sendEmail(connectionId),
    [Tools.CreateLabel]: createLabel(connectionId),
    [Tools.BulkDelete]: bulkDelete(connectionId),
    [Tools.BulkArchive]: bulkArchive(connectionId),
    [Tools.DeleteLabel]: deleteLabel(connectionId),
    [Tools.BuildGmailSearchQuery]: buildGmailSearchQuery(),
    [Tools.GetCurrentDate]: getCurrentDate(),
    [Tools.Think]: think(),
    [Tools.WebSearch]: webSearch(),
    [Tools.SearchEmails]: searchEmails(connectionId),
    [Tools.SearchSimilarEmails]: searchSimilarEmails(connectionId),
    [Tools.InboxRag]: tool({
      description:
        'Search emails using natural language and return the actual email content. Use this when user wants to find, read, understand, or answer questions about emails.',
      inputSchema: z.object({
        query: z.string().describe('The query to search for'),
        maxResults: z.number().describe('The maximum number of results to return').default(5),
        folder: z.string().describe('The folder to search (use "all mail" to search everywhere)').default('all mail'),
      }),
      execute: async ({ query, maxResults, folder }) => {
        console.log('[InboxRag] Executing with params:', { query, folder, maxResults });
        const { stub: agent } = await getZeroAgent(connectionId);
        const res = await agent.searchThreads({ query, maxResults, folder });
        console.log('[InboxRag] searchThreads result:', { threadIds: res.threadIds, source: res.source });

        if (!res.threadIds || res.threadIds.length === 0) {
          return {
            message: 'No emails found matching your search.',
            emails: [],
          };
        }

        // Automatically fetch email content for each thread (up to maxResults)
        const emails: Array<{
          threadId: string;
          subject: string;
          messages: Array<{
            subject: string;
            body: string;
            from: string;
            fromName: string;
            to: string[];
            date: string;
          }>;
        }> = [];

        for (const threadId of res.threadIds.slice(0, maxResults)) {
          try {
            const { result: thread } = await getThread(connectionId, threadId);
            if (thread?.messages && thread.messages.length > 0) {
              const threadMessages = thread.messages.slice(0, 5).map((message) => ({
                subject: message.subject || '',
                body: message.decodedBody?.slice(0, 2000) || '', // Limit body to prevent bloat
                from: message.sender?.email || '',
                fromName: message.sender?.name || '',
                to: message.to?.map((t) => t.email) || [],
                date: message.receivedOn || '',
              }));

              emails.push({
                threadId,
                subject: thread.latest?.subject || threadMessages[0]?.subject || '',
                messages: threadMessages,
              });
            }
          } catch (error) {
            console.error(`[InboxRag] Error fetching thread ${threadId}:`, error);
          }
        }

        console.log('[InboxRag] Returning', emails.length, 'emails with content');
        return {
          message: `Found ${emails.length} email(s) matching your search.`,
          emails,
        };
      },
    }),
  };
};
