export interface ApiEnv {
  WORKER_SERVICE: Fetcher;
  HYPERDRIVE: Hyperdrive;
  
  NODE_ENV: string;
  JWT_SECRET: string;
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
  ZERO_CLIENT_ID: string;
  ZERO_CLIENT_SECRET: string;
  VITE_PUBLIC_BACKEND_URL: string;
  REDIS_URL: string;
  REDIS_TOKEN: string;
  MICROSOFT_CLIENT_ID: string;
  MICROSOFT_CLIENT_SECRET: string;
  VOICE_SECRET: string;
  MEET_AUTH_HEADER: string;
  MEET_API_URL: string;
  ENABLE_MEET: string;
}

export let env: ApiEnv;

export const setEnv = (newEnv: ApiEnv) => {
  env = newEnv;
};

export type ZeroEnv = ApiEnv;
