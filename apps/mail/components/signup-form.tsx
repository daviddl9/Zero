import { Google, Microsoft } from '@/components/icons/icons';
import { Button } from '@/components/ui/button';
import { signIn } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

interface SignupFormProps extends React.ComponentProps<'div'> {
  providers?: any[];
}

export function SignupForm({ className, providers = [], ...props }: SignupFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSocialSignup = async (provider: string) => {
    setIsLoading(true);
    try {
      await signIn.social({
        provider: provider,
        callbackURL: `${window.location.origin}/mail`,
      });
    } catch (error) {
      toast.error('Signup failed. Please try again.');
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
        <h1 className="text-2xl font-bold text-white">Create a Zero Account</h1>
        <div className="text-center text-sm">
          <span className="text-white/60">Already have an account? </span>
          <a href="/login" className="text-white hover:text-white/80">
            Login.
          </a>
        </div>
      </div>

      <div className="grid gap-3">
        {googleProvider && (
          <Button
            variant="outline"
            className="w-full border-white/20 bg-black/20 text-white hover:bg-white/10"
            onClick={() => handleSocialSignup('google')}
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
            onClick={() => handleSocialSignup('microsoft')}
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