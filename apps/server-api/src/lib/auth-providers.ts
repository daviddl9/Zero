// import type { ApiEnv } from '../env';

export interface AuthProvider {
  id: string;
  name: string;
  enabled: boolean;
  required?: boolean;
  envVarInfo?: Array<{
    name: string;
    source: string;
    defaultValue?: string;
  }>;
}

export const authProviders = (env: Record<string, string>): AuthProvider[] => [
  {
    id: 'google',
    name: 'Google',
    enabled: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    required: true,
    envVarInfo: [
      { name: 'GOOGLE_CLIENT_ID', source: 'Google Console' },
      { name: 'GOOGLE_CLIENT_SECRET', source: 'Google Console' },
    ],
  },
  {
    id: 'github',
    name: 'GitHub',
    enabled: !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
    envVarInfo: [
      { name: 'GITHUB_CLIENT_ID', source: 'GitHub App' },
      { name: 'GITHUB_CLIENT_SECRET', source: 'GitHub App' },
    ],
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    enabled: !!(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET),
    envVarInfo: [
      { name: 'MICROSOFT_CLIENT_ID', source: 'Azure App Registration' },
      { name: 'MICROSOFT_CLIENT_SECRET', source: 'Azure App Registration' },
    ],
  },
];

export const customProviders = [
  {
    id: 'zero',
    name: 'Zero',
    isCustom: true,
    customRedirectPath: '/auth/zero/callback',
  },
];

export const isProviderEnabled = (provider: AuthProvider, env: Record<string, string>): boolean => {
  if (!provider.envVarInfo) return true;
  return provider.envVarInfo.every(envVar => !!env[envVar.name]);
};
