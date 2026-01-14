/**
 * AI Client Resolver
 *
 * Resolves the appropriate AI client and models based on user settings.
 * Falls back to server defaults when user has no custom configuration.
 */

import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from '@ai-sdk/google';
import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai';
import { decryptApiKey, parseEncryptedKey } from './encryption';
import { getZeroDB } from './server-utils';
import type { ZeroEnv } from '../env';

// Default models (Gemini is server default per requirements)
export const DEFAULT_COMPOSITION_MODEL = 'gemini-3-pro-preview';
export const DEFAULT_SUMMARIZATION_MODEL = 'gemini-3-flash-preview';

// Fallback models for when user hasn't configured anything
export const FALLBACK_OPENAI_COMPOSITION_MODEL = 'gpt-5';
export const FALLBACK_OPENAI_SUMMARIZATION_MODEL = 'gpt-5-mini';

export interface AIClientConfig {
  provider: 'openai' | 'gemini';
  openai?: OpenAIProvider;
  google?: GoogleGenerativeAIProvider;
  defaultModel: string;
  summarizationModel: string;
  isUserConfigured: boolean;
}

/**
 * Resolves the AI client configuration based on user settings.
 *
 * Priority:
 * 1. User's configured provider + API key + model preferences
 * 2. Server default (Gemini with GOOGLE_GENERATIVE_AI_API_KEY)
 *
 * @param userId - The user's ID
 * @param env - The environment variables
 * @returns AI client configuration
 */
export async function resolveAIClient(userId: string, env: ZeroEnv): Promise<AIClientConfig> {
  const db = await getZeroDB(userId);
  const userSettings = await db.findUserSettings();

  const settings = userSettings?.settings as any;
  const userProvider = settings?.aiProvider as 'openai' | 'gemini' | null;

  // Check if user has a configured provider with a valid key
  if (userProvider && env.ENCRYPTION_MASTER_KEY) {
    const encryptedKey =
      userProvider === 'openai'
        ? userSettings?.encryptedOpenaiKey
        : userSettings?.encryptedGeminiKey;

    if (encryptedKey) {
      const encrypted = parseEncryptedKey(encryptedKey);
      if (encrypted) {
        try {
          const apiKey = await decryptApiKey(encrypted, env.ENCRYPTION_MASTER_KEY);

          // User's custom model preferences or defaults for their provider
          const defaultModel =
            settings?.defaultModel ||
            (userProvider === 'openai'
              ? FALLBACK_OPENAI_COMPOSITION_MODEL
              : DEFAULT_COMPOSITION_MODEL);
          const summarizationModel =
            settings?.summarizationModel ||
            (userProvider === 'openai'
              ? FALLBACK_OPENAI_SUMMARIZATION_MODEL
              : DEFAULT_SUMMARIZATION_MODEL);

          if (userProvider === 'openai') {
            return {
              provider: 'openai',
              openai: createOpenAI({ apiKey }),
              defaultModel,
              summarizationModel,
              isUserConfigured: true,
            };
          } else {
            return {
              provider: 'gemini',
              google: createGoogleGenerativeAI({ apiKey }),
              defaultModel,
              summarizationModel,
              isUserConfigured: true,
            };
          }
        } catch (error) {
          console.error('Failed to decrypt user API key, falling back to server default:', error);
        }
      }
    }
  }

  // Fall back to server default (Gemini)
  if (env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return {
      provider: 'gemini',
      google: createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY }),
      defaultModel: settings?.defaultModel || DEFAULT_COMPOSITION_MODEL,
      summarizationModel: settings?.summarizationModel || DEFAULT_SUMMARIZATION_MODEL,
      isUserConfigured: false,
    };
  }

  // Final fallback to OpenAI if no Gemini key available
  if (env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      openai: createOpenAI({ apiKey: env.OPENAI_API_KEY }),
      defaultModel: settings?.defaultModel || FALLBACK_OPENAI_COMPOSITION_MODEL,
      summarizationModel: settings?.summarizationModel || FALLBACK_OPENAI_SUMMARIZATION_MODEL,
      isUserConfigured: false,
    };
  }

  throw new Error(
    'No AI provider configured - please set GOOGLE_GENERATIVE_AI_API_KEY or OPENAI_API_KEY',
  );
}

/**
 * Gets the model instance for composition tasks
 */
export function getCompositionModel(config: AIClientConfig) {
  if (config.provider === 'openai' && config.openai) {
    return config.openai(config.defaultModel);
  } else if (config.provider === 'gemini' && config.google) {
    return config.google(config.defaultModel);
  }
  throw new Error('Invalid AI client configuration');
}

/**
 * Gets the model instance for summarization tasks
 */
export function getSummarizationModel(config: AIClientConfig) {
  if (config.provider === 'openai' && config.openai) {
    return config.openai(config.summarizationModel);
  } else if (config.provider === 'gemini' && config.google) {
    return config.google(config.summarizationModel);
  }
  throw new Error('Invalid AI client configuration');
}
