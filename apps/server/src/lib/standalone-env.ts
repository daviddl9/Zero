/**
 * Standalone Environment Module
 *
 * Provides a Node.js-compatible environment that reads from process.env
 * and provides a similar interface to ZeroEnv but without Cloudflare bindings.
 */

export interface StandaloneEnv {
  // Core configuration
  NODE_ENV: 'local' | 'development' | 'production';
  DATABASE_URL: string;
  BASE_URL: string;
  VITE_PUBLIC_APP_URL: string;
  VITE_PUBLIC_BACKEND_URL: string;

  // Authentication
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_TRUSTED_ORIGINS: string;
  COOKIE_DOMAIN: string;
  JWT_SECRET: string;

  // OAuth Providers
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  GOOGLE_APPLICATION_CREDENTIALS: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  MICROSOFT_CLIENT_ID: string;
  MICROSOFT_CLIENT_SECRET: string;

  // Redis
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  REDIS_PASSWORD?: string;
  REDIS_URL?: string;
  REDIS_TOKEN?: string;

  // AI Services
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  OPENAI_MINI_MODEL: string;
  ANTHROPIC_API_KEY: string;
  GOOGLE_GENERATIVE_AI_API_KEY: string;
  GROQ_API_KEY: string;
  PERPLEXITY_API_KEY: string;
  AI_SYSTEM_PROMPT: string;
  USE_OPENAI: string;

  // External Services
  RESEND_API_KEY: string;
  COMPOSIO_API_KEY: string;
  AUTUMN_SECRET_KEY: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_PHONE_NUMBER: string;

  // Analytics & Monitoring
  VITE_PUBLIC_POSTHOG_KEY: string;
  VITE_PUBLIC_POSTHOG_HOST: string;
  AXIOM_API_TOKEN: string;
  AXIOM_DATASET: string;
  DD_API_KEY: string;
  DD_APP_KEY: string;
  DD_SITE: string;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_HEADERS?: string;
  OTEL_SERVICE_NAME?: string;

  // Feature Flags
  DISABLE_CALLS: string;
  DISABLE_WORKFLOWS: string;
  EARLY_ACCESS_ENABLED: string;
  ENABLE_MEET: 'true' | 'false';
  MEMORY_ENABLED?: boolean;

  // Security
  VOICE_SECRET: string;
  ENCRYPTION_MASTER_KEY?: string;

  // S3/MinIO (Object Storage)
  S3_ENDPOINT?: string;
  S3_ACCESS_KEY?: string;
  S3_SECRET_KEY?: string;
  S3_BUCKET?: string;
  S3_REGION?: string;

  // Self-hosted / Standalone mode
  SELF_HOSTED?: string;
  STANDALONE?: string;
  ENABLE_JOB_QUEUE?: string;
  ENABLE_SCHEDULER?: string;
  WORKER_CONCURRENCY?: string;

  // Zero OAuth (for MCP)
  ZERO_CLIENT_ID: string;
  ZERO_CLIENT_SECRET: string;

  // Misc
  ARCADE_API_KEY: string;
  ELEVENLABS_API_KEY: string;
  VITE_PUBLIC_ELEVENLABS_AGENT_ID: string;
  REACT_SCAN: string;
  GOOGLE_S_ACCOUNT: string;
  HISTORY_OFFSET: string;
  DEV_PROXY: string;
  MEET_AUTH_HEADER: string;
  MEET_API_URL: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  AUTORAG_ID: string;
  DROP_AGENT_TABLES: string;
  THREAD_SYNC_MAX_COUNT: string;
  THREAD_SYNC_LOOP: string;
}

/**
 * Get standalone environment configuration from process.env
 */
export function getStandaloneEnv(): StandaloneEnv {
  return {
    // Core configuration
    NODE_ENV: (process.env.NODE_ENV as StandaloneEnv['NODE_ENV']) || 'development',
    DATABASE_URL:
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/zerodotemail',
    BASE_URL: process.env.BASE_URL || 'http://localhost:8787',
    VITE_PUBLIC_APP_URL: process.env.VITE_PUBLIC_APP_URL || 'http://localhost:3000',
    VITE_PUBLIC_BACKEND_URL: process.env.VITE_PUBLIC_BACKEND_URL || 'http://localhost:8787',

    // Authentication
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || 'standalone-secret',
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || 'http://localhost:8787',
    BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS || 'http://localhost:3000',
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || 'localhost',
    JWT_SECRET: process.env.JWT_SECRET || 'secret',

    // OAuth Providers
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || '',
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || '',
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || '',
    MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID || '',
    MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET || '',

    // Redis
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    REDIS_URL: process.env.REDIS_URL,
    REDIS_TOKEN: process.env.REDIS_TOKEN,

    // AI Services
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o',
    OPENAI_MINI_MODEL: process.env.OPENAI_MINI_MODEL || 'gpt-4o-mini',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
    GROQ_API_KEY: process.env.GROQ_API_KEY || '',
    PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || '',
    AI_SYSTEM_PROMPT: process.env.AI_SYSTEM_PROMPT || '',
    USE_OPENAI: process.env.USE_OPENAI || 'true',

    // External Services
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',
    COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY || '',
    AUTUMN_SECRET_KEY: process.env.AUTUMN_SECRET_KEY || '',
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',

    // Analytics & Monitoring
    VITE_PUBLIC_POSTHOG_KEY: process.env.VITE_PUBLIC_POSTHOG_KEY || '',
    VITE_PUBLIC_POSTHOG_HOST: process.env.VITE_PUBLIC_POSTHOG_HOST || '',
    AXIOM_API_TOKEN: process.env.AXIOM_API_TOKEN || '',
    AXIOM_DATASET: process.env.AXIOM_DATASET || '',
    DD_API_KEY: process.env.DD_API_KEY || '',
    DD_APP_KEY: process.env.DD_APP_KEY || '',
    DD_SITE: process.env.DD_SITE || '',
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    OTEL_EXPORTER_OTLP_HEADERS: process.env.OTEL_EXPORTER_OTLP_HEADERS,
    OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME,

    // Feature Flags
    DISABLE_CALLS: process.env.DISABLE_CALLS || '',
    DISABLE_WORKFLOWS: process.env.DISABLE_WORKFLOWS || '',
    EARLY_ACCESS_ENABLED: process.env.EARLY_ACCESS_ENABLED || '',
    ENABLE_MEET: (process.env.ENABLE_MEET as 'true' | 'false') || 'false',
    MEMORY_ENABLED: process.env.MEMORY_ENABLED === 'true',

    // Security
    VOICE_SECRET: process.env.VOICE_SECRET || '',
    ENCRYPTION_MASTER_KEY: process.env.ENCRYPTION_MASTER_KEY,

    // S3/MinIO
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
    S3_SECRET_KEY: process.env.S3_SECRET_KEY,
    S3_BUCKET: process.env.S3_BUCKET,
    S3_REGION: process.env.S3_REGION,

    // Self-hosted / Standalone mode
    SELF_HOSTED: process.env.SELF_HOSTED,
    STANDALONE: process.env.STANDALONE || 'true',
    ENABLE_JOB_QUEUE: process.env.ENABLE_JOB_QUEUE,
    ENABLE_SCHEDULER: process.env.ENABLE_SCHEDULER,
    WORKER_CONCURRENCY: process.env.WORKER_CONCURRENCY,

    // Zero OAuth
    ZERO_CLIENT_ID: process.env.ZERO_CLIENT_ID || '',
    ZERO_CLIENT_SECRET: process.env.ZERO_CLIENT_SECRET || '',

    // Misc
    ARCADE_API_KEY: process.env.ARCADE_API_KEY || '',
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
    VITE_PUBLIC_ELEVENLABS_AGENT_ID: process.env.VITE_PUBLIC_ELEVENLABS_AGENT_ID || '',
    REACT_SCAN: process.env.REACT_SCAN || '',
    GOOGLE_S_ACCOUNT: process.env.GOOGLE_S_ACCOUNT || '',
    HISTORY_OFFSET: process.env.HISTORY_OFFSET || '',
    DEV_PROXY: process.env.DEV_PROXY || '',
    MEET_AUTH_HEADER: process.env.MEET_AUTH_HEADER || '',
    MEET_API_URL: process.env.MEET_API_URL || '',
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || '',
    AUTORAG_ID: process.env.AUTORAG_ID || '',
    DROP_AGENT_TABLES: process.env.DROP_AGENT_TABLES || 'false',
    THREAD_SYNC_MAX_COUNT: process.env.THREAD_SYNC_MAX_COUNT || '10',
    THREAD_SYNC_LOOP: process.env.THREAD_SYNC_LOOP || 'false',
  };
}

// Singleton instance for consistent access
let standaloneEnvInstance: StandaloneEnv | null = null;

/**
 * Get the standalone environment (singleton)
 */
export function standaloneEnv(): StandaloneEnv {
  if (!standaloneEnvInstance) {
    standaloneEnvInstance = getStandaloneEnv();
  }
  return standaloneEnvInstance;
}

/**
 * Check if we're running in standalone mode
 */
export function isStandaloneMode(): boolean {
  return process.env.STANDALONE === 'true' || process.env.SELF_HOSTED === 'true';
}
