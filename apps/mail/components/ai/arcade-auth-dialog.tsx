import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '../ui/button';

interface ArcadeAuthDialogProps {
  toolName: string | null;
  onAuthorized?: () => void;
  onCancel?: () => void;
}

export function ArcadeAuthDialog({ toolName, onAuthorized, onCancel }: ArcadeAuthDialogProps) {
  const [isWaiting, setIsWaiting] = useState(false);
  const [authId, setAuthId] = useState<string | null>(null);
  const trpc = useTRPC();

  // Check if tool needs authorization
  const { data: authStatus } = useQuery(
    trpc.arcadeConnections.checkAuthorization.queryOptions(
      { toolName: toolName || '' },
      {
        enabled: !!toolName,
      },
    ),
  );

  // Wait for authorization mutation
  const { mutateAsync: waitForAuth } = useMutation(
    trpc.arcadeConnections.waitForAuthorization.mutationOptions(),
  );

  useEffect(() => {
    if (authStatus?.authId && authStatus.authId !== authId) {
      setAuthId(authStatus.authId);
    }
  }, [authStatus?.authId, authId]);

  const handleAuthorize = () => {
    if (authStatus?.authUrl) {
      window.open(authStatus.authUrl, '_blank');
      setIsWaiting(true);

      // Start polling for authorization completion
      if (authId) {
        waitForAuth({ authId })
          .then((result) => {
            if (result.success) {
              onAuthorized?.();
            }
          })
          .catch(() => {
            setIsWaiting(false);
          });
      }
    }
  };

  const handleCancel = () => {
    setIsWaiting(false);
    onCancel?.();
  };

  if (!toolName || !authStatus?.needsAuth) {
    return null;
  }

  return (
    <Dialog
      open={!!toolName && authStatus.needsAuth}
      onOpenChange={(open) => !open && handleCancel()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Authorization Required</DialogTitle>
          <DialogDescription>
            The AI assistant needs your permission to use <strong>{toolName}</strong>. This will
            allow the assistant to perform actions on your behalf.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isWaiting ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-muted-foreground text-sm">
                Waiting for authorization... Please complete the authorization in the new window.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm">
                Click the button below to authorize this tool. A new window will open where you can
                grant the necessary permissions.
              </p>

              {authStatus.error && <p className="text-destructive text-sm">{authStatus.error}</p>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isWaiting}>
            Cancel
          </Button>
          {!isWaiting && (
            <Button onClick={handleAuthorize}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Authorize {toolName}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
