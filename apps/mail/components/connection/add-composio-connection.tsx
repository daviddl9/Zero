import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../ui/dialog';
import { useComposioConnections } from '@/hooks/use-composio-connection';
import { Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import { useTRPC } from '@/providers/query-provider';
import { useMutation } from '@tanstack/react-query';
import { GitHub, Linear } from '../icons/icons';
import { Button } from '../ui/button';
import { useState } from 'react';
import { toast } from 'sonner';

// Import Stripe icon
const Stripe = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.831 3.47 1.426 3.47 2.338 0 .914-.796 1.431-2.126 1.431-1.72 0-4.516-.924-6.378-2.168l-.9 5.555C7.986 22.18 10.194 23 13.714 23c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.467-3.235 2.467-5.732 0-4.128-2.524-5.851-6.594-7.305h-.039z" />
    </svg>
);

export const toolkitIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    github: GitHub,
    stripe: Stripe,
    linear: Linear,
};

export const AddComposioConnectionDialog = ({
    children,
    onSuccess,
}: {
    children?: React.ReactNode;
    onSuccess?: () => void;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [connectingToolkit, setConnectingToolkit] = useState<string | null>(null);
    const { toolkits, connections, isLoading, authorizeToolkit } = useComposioConnections();
    const trpc = useTRPC();
    const { mutateAsync: createConnection } = useMutation(
        trpc.composioConnections.createConnection.mutationOptions(),
    );

    const handleConnect = async (toolkit: string) => {
        setConnectingToolkit(toolkit);
        try {
            const authResult = await authorizeToolkit(toolkit.toLowerCase());

            console.log('[COMPOSIO AUTH RESULT]', authResult);

            if (authResult?.authUrl && authResult?.authId) {
                const authWindow = window.open(authResult.authUrl, '_blank', 'width=600,height=600');

                const checkInterval = setInterval(async () => {
                    if (authWindow?.closed) {
                        clearInterval(checkInterval);

                        try {
                            await createConnection({
                                toolkit,
                                authId: authResult.authId,
                            });

                            toast.success(`Successfully connected ${toolkit}`);
                            setConnectingToolkit(null);
                            onSuccess?.();
                        } catch {
                            console.log('Authorization not complete or failed');
                            setConnectingToolkit(null);
                        }
                    }
                }, 1000);

                setTimeout(
                    () => {
                        clearInterval(checkInterval);
                        setConnectingToolkit(null);
                    },
                    5 * 60 * 1000,
                );
            }
        } catch (error) {
            console.error('Failed to connect toolkit:', error);
            toast.error(`Failed to connect ${toolkit}`);
            setConnectingToolkit(null);
        }
    };

    const isConnected = (toolkit: string) => {
        return connections.some((c) => c.service === toolkit.toLowerCase());
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent showOverlay={true} className="max-h-[80vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add Composio Integration</DialogTitle>
                    <DialogDescription>
                        Connect to GitHub, Stripe, and Linear through Composio to enhance Zero Mail with AI-powered tools
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : toolkits.length === 0 ? (
                    <div className="text-muted-foreground py-8 text-center">
                        <Sparkles className="mx-auto mb-4 h-12 w-12 opacity-50" />
                        <p className="text-sm">No integrations available</p>
                        <p className="mt-1 text-xs">Please check your Composio API key configuration</p>
                    </div>
                ) : (
                    <div className="mt-4 space-y-3">
                        {toolkits.map((toolkit) => {
                            const Icon = toolkitIcons[toolkit.name.toLowerCase()] || Sparkles;
                            const connected = isConnected(toolkit.name);

                            return (
                                <div
                                    key={toolkit.name}
                                    className={`relative rounded-lg border p-4 transition-colors ${connected
                                        ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                                        : 'hover:border-primary/50'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-medium capitalize">{toolkit.name}</h3>
                                            <p className="text-muted-foreground mt-1 text-sm">{toolkit.description}</p>
                                            <p className="text-muted-foreground mt-1 text-xs">
                                                {toolkit.toolCount} tools available
                                            </p>
                                        </div>
                                        {connected ? (
                                            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleConnect(toolkit.name)}
                                                disabled={connectingToolkit === toolkit.name}
                                                className="shrink-0"
                                            >
                                                {connectingToolkit === toolkit.name ? (
                                                    <>
                                                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                                        Connecting
                                                    </>
                                                ) : (
                                                    'Connect'
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
