import { Google, Microsoft } from '@/components/icons/icons';
import { Button } from '@/components/ui/button';
import { signIn } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

interface LoginFormProps extends React.ComponentProps<'div'> {
  providers?: any[];
}

export function LoginForm({ className, providers = [], ...props }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSocialLogin = async (provider: string) => {
    setIsLoading(true);
    try {
      await signIn.social({
        provider: provider,
        callbackURL: `${window.location.origin}/mail`,
      });
    } catch (error) {
      toast.error('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Find available providers
  const googleProvider = providers.find((p) => p.id === 'google' && p.enabled);
  const microsoftProvider = providers.find((p) => p.id === 'microsoft' && p.enabled);

  return (
    <div className={cn('flex flex-col gap-4', className)} {...props}>
      <div className="flex flex-col items-center text-center">
        <h1 className="text-2xl font-bold text-white">Log in to Zero</h1>
        <div className="text-center text-sm">
          <span className="text-white/60">Don&apos;t have an account? </span>
          <a href="/signup" className="text-white hover:text-white/80">
            Sign up.
          </a>
        </div>
      </div>

      <div className="grid gap-3">
        {googleProvider && (
          <Button
            variant="outline"
            className="w-full border-white/20 bg-black/20 text-white hover:bg-white/10"
            onClick={() => handleSocialLogin('google')}
            disabled={isLoading}
            type="button"
          >
            <Google className="mr-2 h-4 w-4" />
            Continue with Google
          </Button>
        )}

        {microsoftProvider && (
          <Button
            variant="outline"
            className="w-full border-white/20 bg-black/20 text-white hover:bg-white/10"
            onClick={() => handleSocialLogin('microsoft')}
            disabled={isLoading}
            type="button"
          >
            <Microsoft className="mr-2 h-4 w-4" />
            Continue with Microsoft
          </Button>
        )}
      </div>
    </div>
  );
}
