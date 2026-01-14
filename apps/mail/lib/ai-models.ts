/**
 * AI Model Constants
 *
 * Defines available AI providers and models for user selection.
 */

export type AIProvider = 'openai' | 'gemini';

export interface ModelOption {
  value: string;
  label: string;
  description?: string;
}

export interface ProviderConfig {
  id: AIProvider;
  name: string;
  description: string;
  compositionModels: ModelOption[];
  summarizationModels: ModelOption[];
}

/**
 * OpenAI model options
 */
export const OPENAI_MODELS: ModelOption[] = [
  {
    value: 'gpt-5.2-pro',
    label: 'GPT-5.2 Pro',
    description: 'Most capable model for complex tasks',
  },
  {
    value: 'gpt-5.2',
    label: 'GPT-5.2',
    description: 'Latest flagship model',
  },
  {
    value: 'gpt-5',
    label: 'GPT-5',
    description: 'Previous generation flagship',
  },
  {
    value: 'gpt-5-mini',
    label: 'GPT-5 Mini',
    description: 'Fast and cost-effective',
  },
  {
    value: 'gpt-5-nano',
    label: 'GPT-5 Nano',
    description: 'Fastest and cheapest option',
  },
];

/**
 * Gemini model options
 */
export const GEMINI_MODELS: ModelOption[] = [
  {
    value: 'gemini-3-pro-preview',
    label: 'Gemini 3 Pro',
    description: 'Most capable for composition (Default)',
  },
  {
    value: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash',
    description: 'Fast and efficient (Default for summarization)',
  },
];

/**
 * Provider configurations
 */
export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-5 series models from OpenAI',
    compositionModels: OPENAI_MODELS,
    summarizationModels: OPENAI_MODELS,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini 3 models from Google',
    compositionModels: GEMINI_MODELS,
    summarizationModels: GEMINI_MODELS,
  },
];

/**
 * Server default configuration (Gemini)
 */
export const SERVER_DEFAULTS = {
  provider: 'gemini' as AIProvider,
  compositionModel: 'gemini-3-pro-preview',
  summarizationModel: 'gemini-3-flash-preview',
};

/**
 * Get models for a specific provider
 */
export function getModelsForProvider(
  provider: AIProvider,
  type: 'composition' | 'summarization',
): ModelOption[] {
  const config = PROVIDERS.find((p) => p.id === provider);
  if (!config) return [];
  return type === 'composition' ? config.compositionModels : config.summarizationModels;
}

/**
 * Get default model for a provider and type
 */
export function getDefaultModel(
  provider: AIProvider | null,
  type: 'composition' | 'summarization',
): string {
  if (!provider || provider === 'gemini') {
    return type === 'composition'
      ? SERVER_DEFAULTS.compositionModel
      : SERVER_DEFAULTS.summarizationModel;
  }

  // OpenAI defaults
  return type === 'composition' ? 'gpt-5' : 'gpt-5-mini';
}
