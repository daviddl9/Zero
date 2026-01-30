import {
  encryptApiKey,
  decryptApiKey,
  parseEncryptedKey,
  serializeEncryptedKey,
} from '../../lib/encryption';
import { createRateLimiterMiddleware, privateProcedure, router } from '../trpc';
import { aiProviderSchema, type AIProvider } from '../../lib/schemas';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { getZeroDB } from '../../lib/server-utils';
import { Ratelimit } from '@upstash/ratelimit';
import { createOpenAI } from '@ai-sdk/openai';
import { TRPCError } from '@trpc/server';
import { generateText } from 'ai';
import { z } from 'zod';

/**
 * Validates an API key by making a lightweight test call
 */
async function validateApiKey(
  provider: AIProvider,
  apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    if (provider === 'openai') {
      const openai = createOpenAI({ apiKey });
      // Make a minimal API call to verify the key
      await generateText({
        model: openai('gpt-4o-mini'),
        prompt: 'Say "ok"',
        maxTokens: 5,
      });
    } else {
      const google = createGoogleGenerativeAI({ apiKey });
      // Make a minimal API call to verify the key
      await generateText({
        model: google('gemini-2.0-flash'),
        prompt: 'Say "ok"',
        maxTokens: 5,
      });
    }
    return { valid: true };
  } catch (error) {
    console.error(`API key validation failed for ${provider}:`, error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid API key',
    };
  }
}

export const aiSettingsRouter = router({
  /**
   * Get current AI settings (without raw API keys)
   */
  get: privateProcedure
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(60, '1m'),
        generatePrefix: ({ sessionUser }) => `ratelimit:get-ai-settings-${sessionUser?.id}`,
      }),
    )
    .query(async ({ ctx }) => {
      const { sessionUser } = ctx;
      const db = await getZeroDB(sessionUser.id);
      const result = await db.findUserSettings();

      if (!result) {
        return {
          aiProvider: null,
          hasOpenaiKey: false,
          hasGeminiKey: false,
          defaultModel: null,
          summarizationModel: null,
        };
      }

      const settings = result.settings as any;

      return {
        aiProvider: settings.aiProvider || null,
        hasOpenaiKey: !!result.encryptedOpenaiKey,
        hasGeminiKey: !!result.encryptedGeminiKey,
        defaultModel: settings.defaultModel || null,
        summarizationModel: settings.summarizationModel || null,
      };
    }),

  /**
   * Set AI provider preference
   */
  setProvider: privateProcedure
    .input(z.object({ provider: aiProviderSchema.nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { sessionUser } = ctx;
      const db = await getZeroDB(sessionUser.id);
      const existingSettings = await db.findUserSettings();

      const currentSettings = existingSettings?.settings || {};
      const newSettings = {
        ...currentSettings,
        aiProvider: input.provider,
      };

      if (existingSettings) {
        await db.updateUserSettings(newSettings as any);
      } else {
        await db.insertUserSettings(newSettings as any);
      }

      return { success: true };
    }),

  /**
   * Save and validate API key
   */
  setApiKey: privateProcedure
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(10, '1m'),
        generatePrefix: ({ sessionUser }) => `ratelimit:set-api-key-${sessionUser?.id}`,
      }),
    )
    .input(
      z.object({
        provider: aiProviderSchema,
        apiKey: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { sessionUser, c } = ctx;
      const env = c.env;

      // Validate the API key first
      const validation = await validateApiKey(input.provider, input.apiKey);
      if (!validation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: validation.error || 'Invalid API key',
        });
      }

      // Check if encryption is available
      if (!env.ENCRYPTION_MASTER_KEY) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Encryption not configured on server',
        });
      }

      // Encrypt the API key
      const encrypted = await encryptApiKey(input.apiKey, env.ENCRYPTION_MASTER_KEY);
      const encryptedString = serializeEncryptedKey(encrypted);

      // Store the encrypted key
      const db = await getZeroDB(sessionUser.id);

      // Ensure user settings record exists
      const existingSettings = await db.findUserSettings();
      if (!existingSettings) {
        const currentSettings = existingSettings?.settings || {};
        await db.insertUserSettings({
          ...currentSettings,
          [`has${input.provider.charAt(0).toUpperCase() + input.provider.slice(1)}Key`]: true,
        } as any);
      }

      // Update the encrypted key column
      await db.updateEncryptedApiKey(input.provider, encryptedString);

      // Update the hasXKey flag in settings
      const settings = existingSettings?.settings || {};
      const keyFlag = input.provider === 'openai' ? { hasOpenaiKey: true } : { hasGeminiKey: true };
      await db.updateUserSettings({ ...settings, ...keyFlag } as any);

      return { success: true };
    }),

  /**
   * Clear stored API key
   */
  clearApiKey: privateProcedure
    .input(z.object({ provider: aiProviderSchema }))
    .mutation(async ({ ctx, input }) => {
      const { sessionUser } = ctx;
      const db = await getZeroDB(sessionUser.id);

      // Clear the encrypted key column
      await db.updateEncryptedApiKey(input.provider, null);

      // Update the hasXKey flag in settings
      const existingSettings = await db.findUserSettings();
      if (existingSettings) {
        const settings = existingSettings.settings || {};
        const keyFlag =
          input.provider === 'openai' ? { hasOpenaiKey: false } : { hasGeminiKey: false };
        await db.updateUserSettings({ ...settings, ...keyFlag } as any);
      }

      return { success: true };
    }),

  /**
   * Set model preferences
   */
  setModels: privateProcedure
    .input(
      z.object({
        defaultModel: z.string().nullable(),
        summarizationModel: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { sessionUser } = ctx;
      const db = await getZeroDB(sessionUser.id);
      const existingSettings = await db.findUserSettings();

      const currentSettings = existingSettings?.settings || {};
      const newSettings = {
        ...currentSettings,
        defaultModel: input.defaultModel,
        summarizationModel: input.summarizationModel,
      };

      if (existingSettings) {
        await db.updateUserSettings(newSettings as any);
      } else {
        await db.insertUserSettings(newSettings as any);
      }

      return { success: true };
    }),

  /**
   * Validate an API key without saving
   */
  validateKey: privateProcedure
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(10, '1m'),
        generatePrefix: ({ sessionUser }) => `ratelimit:validate-api-key-${sessionUser?.id}`,
      }),
    )
    .input(
      z.object({
        provider: aiProviderSchema,
        apiKey: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      return await validateApiKey(input.provider, input.apiKey);
    }),

  /**
   * Get decrypted API key for internal use (called by AI services)
   * This should NOT be exposed to the client directly
   */
  getDecryptedKey: privateProcedure
    .input(z.object({ provider: aiProviderSchema }))
    .query(async ({ ctx, input }) => {
      const { sessionUser, c } = ctx;
      const env = c.env;

      if (!env.ENCRYPTION_MASTER_KEY) {
        return { apiKey: null };
      }

      const db = await getZeroDB(sessionUser.id);
      const settings = await db.findUserSettings();

      if (!settings) {
        return { apiKey: null };
      }

      const encryptedKey =
        input.provider === 'openai' ? settings.encryptedOpenaiKey : settings.encryptedGeminiKey;

      if (!encryptedKey) {
        return { apiKey: null };
      }

      const encrypted = parseEncryptedKey(encryptedKey);
      if (!encrypted) {
        return { apiKey: null };
      }

      try {
        const decrypted = await decryptApiKey(encrypted, env.ENCRYPTION_MASTER_KEY);
        return { apiKey: decrypted };
      } catch (error) {
        console.error('Failed to decrypt API key:', error);
        return { apiKey: null };
      }
    }),
});
