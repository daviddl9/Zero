import { trpcClient } from '@/providers/query-provider';
import { useCallback, useState } from 'react';

export interface ToolAuthRequest {
  toolName: string;
  message?: string;
}

export function useArcadeAuth() {
  const [pendingAuth, setPendingAuth] = useState<ToolAuthRequest | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  const checkAuth = useCallback(async (toolName: string) => {
    return await trpcClient.arcadeConnections.checkAuthorization.query({ toolName });
  }, []);

  const requestAuthorization = useCallback(
    async (toolName: string, message?: string) => {
      const authStatus = await checkAuth(toolName);

      if (authStatus.needsAuth) {
        setPendingAuth({ toolName, message });
        return { needsAuth: true, authUrl: authStatus.authUrl, authId: authStatus.authId };
      }

      return { needsAuth: false };
    },
    [checkAuth],
  );

  const handleAuthorization = useCallback(async () => {
    if (!pendingAuth) return;

    setIsAuthorizing(true);
    try {
      setPendingAuth(null);
      return true;
    } finally {
      setIsAuthorizing(false);
    }
  }, [pendingAuth]);

  const handleCancel = useCallback(() => {
    setPendingAuth(null);
    setIsAuthorizing(false);
  }, []);

  const clearPendingAuth = useCallback(() => {
    setPendingAuth(null);
    setIsAuthorizing(false);
  }, []);

  return {
    pendingAuth,
    isAuthorizing,
    requestAuthorization,
    handleAuthorization,
    handleCancel,
    clearPendingAuth,
  };
}
