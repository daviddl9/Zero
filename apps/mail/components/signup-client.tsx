import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import type { EnvVarInfo } from '@zero/server/auth-providers';
import { Google, Microsoft } from '@/components/icons/icons';
import ErrorMessage from '@/app/(auth)/signup/error-message';
import { Button } from '@/components/ui/button';
import { TriangleAlert } from 'lucide-react';
import { signIn } from '@/lib/auth-client';
import { useNavigate } from 'react-router';
import { useQueryState } from 'nuqs';
import { toast } from 'sonner';
import { SignupForm } from '@/components/signup-form';

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

interface SignupClientProps {
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
    default:
      return null;
  }
};

function SignupClientContent({ providers, isProd }: SignupClientProps) {
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
          error: 'Signup redirect failed',
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

  const shouldShowSimpleForm = !hasMissingRequiredProviders;

  if (shouldShowSimpleForm) {
    return (
      <>
        {/* Left Column - Signup Form */}
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
                   <AlertDescription>Failed to sign you up. Please try again.</AlertDescription>
                 </Alert>
               )}
               <ErrorMessage />
               <SignupForm providers={providers} />
            </div>
          </div>
        </div>
        
        {/* Right Column - Image */}
        <div className="bg-muted relative hidden lg:block h-full">
          <img
            src="/couple.jpeg"
            alt="Signup"
            className="absolute inset-0 h-full w-full object-cover brightness-[0.5]"
          />
          {/* Overlay gradient for better text readability if needed */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      </>
    );
  }

  // Fallback to configuration message if providers are missing
  return (
    <div className="flex h-full w-full items-center justify-center bg-black col-span-2">
      <div className="w-full max-w-md px-6 py-8">
        <div className="mb-4 text-center">
          <h1 className="mb-2 text-4xl font-bold text-white">Configuration Required</h1>
          <p className="text-muted-foreground">Please configure authentication providers to enable signup</p>
        </div>
      </div>
    </div>
  );
}

export function SignupClient(props: SignupClientProps) {
  const fallback = (
    <div className="flex h-full w-full items-center justify-center bg-black col-span-2">
      <p className="text-white">Loading...</p>
    </div>
  );

  return (
    <Suspense fallback={fallback}>
      <SignupClientContent {...props} />
    </Suspense>
  );
} 