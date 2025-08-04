import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import type { EnvVarInfo } from '@zero/server/auth-providers';
import { Google, Microsoft } from '@/components/icons/icons';
import ErrorMessage from '@/app/(auth)/login/error-message';
import { Button } from '@/components/ui/button';
import { TriangleAlert } from 'lucide-react';
import { signIn } from '@/lib/auth-client';
import { useNavigate } from 'react-router';
import { useQueryState } from 'nuqs';
import { toast } from 'sonner';
import { LoginForm } from '@/components/login-form';

interface EnvVarStatus {
  name: string;
  set: boolean;
  source: string;
  defaultValue?: string;
}

interface Provider {
  id: string;
  name: string;
  enabled: boolean;
  required?: boolean;
  envVarInfo?: EnvVarInfo[];
  envVarStatus: EnvVarStatus[];
  isCustom?: boolean;
  customRedirectPath?: string;
}

interface LoginClientProps {
  providers: Provider[];
  isProd: boolean;
}

const getProviderIcon = (providerId: string, className?: string): ReactNode => {
  const defaultClass = className || 'w-5 h-5 mr-2';

  switch (providerId) {
    case 'google':
      return <Google className={defaultClass} />;

    case 'microsoft':
      return <Microsoft className={defaultClass} />;

    case 'zero':
      return (
        <img
          src="/white-icon.svg"
          alt="Zero"
          width={15}
          height={15}
          className="mr-2"
        />
      );
    default:
      return null;
  }
};

function LoginClientContent({ providers, isProd }: LoginClientProps) {
  const navigate = useNavigate();
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
  const [error, _] = useQueryState('error');

  useEffect(() => {
    const missing = providers.find((p) => p.required && !p.enabled);
    if (missing?.id) {
      setExpandedProviders({ [missing.id]: true });
    }
  }, [providers]);

  const missingRequiredProviders = providers
    .filter((p) => p.required && !p.enabled)
    .map((p) => p.name);

  const missingProviders = providers
    .filter((p) => p.required && !p.enabled && p.envVarInfo)
    .map((p) => ({
      id: p.id,
      name: p.name,
      envVarInfo: p.envVarInfo || [],
      envVarStatus: p.envVarStatus,
    }));

  const toggleProvider = (providerId: string) => {
    setExpandedProviders((prev) => ({
      ...prev,
      [providerId]: !prev[providerId],
    }));
  };

  const displayProviders = isProd ? providers.filter((p) => p.enabled || p.isCustom) : providers;

  const hasMissingRequiredProviders = missingRequiredProviders.length > 0;

  const shouldShowDetailedConfig = !isProd && hasMissingRequiredProviders;

  const shouldShowSimplifiedMessage = isProd && hasMissingRequiredProviders;

  const handleProviderClick = (provider: Provider) => {
    if (provider.isCustom && provider.customRedirectPath) {
      navigate(provider.customRedirectPath);
    } else {
      toast.promise(
        signIn.social({
          provider: provider.id as any,
          callbackURL: `${window.location.origin}/mail`,
        }),
        {
          error: 'Login redirect failed',
        },
      );
    }
  };

  const sortedProviders = [...displayProviders].sort((a, b) => {
    if (a.id === 'zero') return -1;
    if (b.id === 'zero') return 1;

    if (a.required && !b.required) return -1;
    if (!a.required && b.required) return 1;
    return 0;
  });

  // Check if we should show the simplified login form
  const shouldShowSimpleForm = !hasMissingRequiredProviders;

  if (shouldShowSimpleForm) {
    return (
      <>
        {/* Left Column - Login Form */}
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="flex items-center gap-[18px] p-4 pl-6">
            <a href="/home" className="flex items-center justify-center w-6 h-6 cursor-pointer">
              <div className="w-[48px] h-[48px] cursor-pointer">
                <img 
                  src="/white-icon.svg" 
                  alt="Zero" 
                  width={38} 
                  height={38} 
                  className="w-full h-full cursor-pointer"
                />
              </div>
            </a>
          </div>
          <div className="flex flex-1 items-center justify-center px-6 md:px-10">
            <div className="w-full max-w-xs">
              {error && (
                <Alert variant="default" className="mb-6 border-orange-500/40 bg-orange-500/10">
                  <AlertTitle className="text-orange-400">Error</AlertTitle>
                  <AlertDescription>Failed to log you in. Please try again.</AlertDescription>
                </Alert>
              )}
              <ErrorMessage />
              <LoginForm providers={providers} />
            </div>
          </div>
        </div>
        
        {/* Right Column - Image */}
        <div className="bg-muted relative hidden lg:block h-full">
          <img
            src="/couple.jpeg"
            alt="Login"
            className="absolute inset-0 h-full w-full object-cover brightness-[0.5]"
          />
          {/* Overlay gradient for better text readability if needed */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      </>
    );
  }

  // Fallback to original design for configuration/error states
  return (
    <div className="flex h-full w-full flex-col items-center justify-between bg-black col-span-2">
      <div className="animate-in slide-in-from-bottom-4 mx-auto flex max-w-[600px] flex-grow items-center justify-center space-y-8 px-4 duration-500 sm:px-12 md:px-0">
        <div className="w-full space-y-4">
          <p className="text-center text-4xl font-bold text-white md:text-5xl">Login to Zero</p>

          {error && (
            <Alert variant="default" className="border-orange-500/40 bg-orange-500/10">
              <AlertTitle className="text-orange-400">Error</AlertTitle>
              <AlertDescription>Failed to log you in. Please try again.</AlertDescription>
            </Alert>
          )}

          {shouldShowDetailedConfig && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-5">
              <div className="flex flex-col space-y-4">
                <div className="flex items-center">
                  <TriangleAlert size={28} />
                  <h3 className="ml-2 text-base font-medium text-white">
                    Configuration Required
                  </h3>
                </div>

                <p className="text-sm text-white/80">
                  To enable login with{' '}
                  <span className="font-semibold">{missingRequiredProviders.join(', ')}</span>, add
                  these variables to your{' '}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono">
                    .env
                  </code>{' '}
                  file:
                </p>

                <div className="space-y-3">
                  {missingProviders.map((provider) => (
                    <div
                      key={provider.id}
                      className="overflow-hidden rounded-md border border-white/10"
                    >
                      <button
                        onClick={() => toggleProvider(provider.id)}
                        className="flex w-full items-center justify-between bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10"
                      >
                        <div className="flex items-center">
                          {getProviderIcon(provider.id)}
                          <span className="font-medium text-white">
                            {provider.name}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <span className="mr-2 text-xs text-white/60">
                            {provider.envVarStatus.filter((v) => !v.set).length} missing
                          </span>
                          <svg
                            className={`h-5 w-5 text-white/60 transition-transform duration-200 ${expandedProviders[provider.id] ? 'rotate-180' : ''}`}
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </div>
                      </button>

                      <div
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedProviders[provider.id] ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
                      >
                        <div className="bg-white/[0.03] p-4 font-mono text-sm">
                          {provider.envVarStatus.map((envVar) => (
                            <div
                              key={envVar.name}
                              className={`mb-3 flex items-start transition-all duration-300 ease-in-out last:mb-0 ${expandedProviders[provider.id] ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
                              style={{
                                transitionDelay: expandedProviders[provider.id]
                                  ? `${provider.envVarStatus.indexOf(envVar) * 50}ms`
                                  : '0ms',
                              }}
                            >
                              <div
                                className={`mr-2 mt-1.5 h-2 w-2 rounded-full ${!envVar.set ? 'bg-red-500' : 'bg-green-500'}`}
                              />
                              <div className="flex-1">
                                <div className="flex items-center">
                                  <span className="font-semibold text-white">
                                    {envVar.name}
                                  </span>
                                  <span
                                    className={`ml-2 rounded px-1.5 py-0.5 text-xs ${!envVar.set ? 'bg-red-900/30 text-red-300' : 'bg-green-900/30 text-green-300'}`}
                                  >
                                    {!envVar.set ? 'Missing' : 'Set'}
                                  </span>
                                </div>
                                {!envVar.set && (
                                  <div className="mt-1.5">
                                    <code className="block text-white/80">
                                      {envVar.name}=
                                      {envVar.defaultValue || `# from ${envVar.source}`}
                                    </code>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <a
                  href="https://github.com/Mail-0/Mail-0/blob/main/README.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-white/60 underline underline-offset-2 hover:text-white"
                >
                  Setup instructions in documentation
                  <svg
                    className="ml-1 h-3 w-3"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>
            </div>
          )}

          {shouldShowSimplifiedMessage && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-center">
                <TriangleAlert size={28} />
                <p className="ml-2 text-sm text-white/80">
                  Authentication service unavailable
                </p>
              </div>
            </div>
          )}

          <ErrorMessage />

          {!hasMissingRequiredProviders && (
            <div className="relative z-10 mx-auto flex w-full flex-col items-center justify-center gap-2">
              {sortedProviders.map(
                (provider) =>
                  (provider.enabled || provider.isCustom) && (
                    <Button
                      key={provider.id}
                      onClick={() => handleProviderClick(provider)}
                      className="border-input bg-background text-primary hover:bg-accent hover:text-accent-foreground h-12 w-full rounded-lg border-2"
                    >
                      {getProviderIcon(provider.id)}
                      Continue with {provider.name}
                    </Button>
                  ),
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="w-full px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-6">
          <a href={'/'} className="text-white/60 hover:text-white">Return home</a>
          <a
            href="/terms"
            className="text-[10px] text-gray-500 transition-colors hover:text-gray-300"
          >
            Terms of Service
          </a>
          <a
            href="/privacy"
            className="text-[10px] text-gray-500 transition-colors hover:text-gray-300"
          >
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
}

export function LoginClient(props: LoginClientProps) {
  const fallback = (
    <div className="flex h-full w-full items-center justify-center bg-black col-span-2">
      <p className="text-white">Loading...</p>
    </div>
  );

  return (
    <Suspense fallback={fallback}>
      <LoginClientContent {...props} />
    </Suspense>
  );
}
