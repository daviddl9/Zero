export interface ZeroEnv {
  ZERO_DRIVER: DurableObjectNamespace;
  SHARD_REGISTRY: DurableObjectNamespace;
  ZERO_DB: DurableObjectNamespace;
  ZERO_AGENT: DurableObjectNamespace;
  ZERO_MCP: DurableObjectNamespace;
  THINKING_MCP: DurableObjectNamespace;
  WORKFLOW_RUNNER: DurableObjectNamespace;
  THREAD_SYNC_WORKER: DurableObjectNamespace;

  SYNC_THREADS_WORKFLOW: Workflow;
  SYNC_THREADS_COORDINATOR_WORKFLOW: Workflow;

  HYPERDRIVE: Hyperdrive;

  pending_emails_status: KVNamespace;
  pending_emails_payload: KVNamespace;
  scheduled_emails: KVNamespace;
  snoozed_emails: KVNamespace;
  gmail_sub_age: KVNamespace;
  gmail_history_id: KVNamespace;
  gmail_processing_threads: KVNamespace;
  subscribed_accounts: KVNamespace;
  connection_labels: KVNamespace;
  prompts_storage: KVNamespace;

  send_email_queue: Queue;
  subscribe_queue: Queue;
  thread_queue: Queue;

  THREADS_BUCKET: R2Bucket;

  AI: Ai;
  VECTORIZE: VectorizeIndex;
  VECTORIZE_MESSAGE: VectorizeIndex;

  NODE_ENV: string;
  JWT_SECRET: string;
  ELEVENLABS_API_KEY: string;
  DISABLE_CALLS: string;
  DROP_AGENT_TABLES: string;
  THREAD_SYNC_MAX_COUNT: string;
  THREAD_SYNC_LOOP: string;
  DISABLE_WORKFLOWS: string;
  AUTORAG_ID: string;
  USE_OPENAI: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  BASE_URL: string;
  VITE_PUBLIC_APP_URL: string;
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  RESEND_API_KEY: string;
  VITE_PUBLIC_POSTHOG_KEY: string;
  VITE_PUBLIC_POSTHOG_HOST: string;
  COOKIE_DOMAIN: string;
  BETTER_AUTH_TRUSTED_ORIGINS: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  GOOGLE_APPLICATION_CREDENTIALS: string;
  HISTORY_OFFSET: string;
  ZERO_CLIENT_ID: string;
  ZERO_CLIENT_SECRET: string;
  VITE_PUBLIC_BACKEND_URL: string;
  REDIS_URL: string;
  REDIS_TOKEN: string;
  OPENAI_API_KEY: string;
  BRAIN_URL: string;
  COMPOSIO_API_KEY: string;
  GROQ_API_KEY: string;
  EARLY_ACCESS_ENABLED: string;
  GOOGLE_GENERATIVE_AI_API_KEY: string;
  AUTUMN_SECRET_KEY: string;
  AI_SYSTEM_PROMPT: string;
  PERPLEXITY_API_KEY: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_PHONE_NUMBER: string;
  VITE_PUBLIC_ELEVENLABS_AGENT_ID: string;
  REACT_SCAN: string;
  MICROSOFT_CLIENT_ID: string;
  MICROSOFT_CLIENT_SECRET: string;
  VOICE_SECRET: string;
  ARCADE_API_KEY: string;
  OPENAI_MODEL: string;
  OPENAI_MINI_MODEL: string;
  ANTHROPIC_API_KEY: string;
  GOOGLE_S_ACCOUNT: string;
  AXIOM_API_TOKEN: string;
  AXIOM_DATASET: string;
  DEV_PROXY: string;
  MEET_AUTH_HEADER: string;
  MEET_API_URL: string;
  ENABLE_MEET: string;
  OTEL_EXPORTER_OTLP_ENDPOINT: string;
  OTEL_EXPORTER_OTLP_HEADERS: string;
  OTEL_SERVICE_NAME: string;
}

export let env: ZeroEnv;

export const setEnv = (newEnv: ZeroEnv) => {
  env = newEnv;
};
