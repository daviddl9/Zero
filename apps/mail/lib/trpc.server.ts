import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@zero/server/trpc';
import superjson from 'superjson';

const getUrl = () => {
  const base = typeof window !== 'undefined' ? window.location.origin : (import.meta.env.VITE_PUBLIC_BACKEND_URL || '');
  return (base.endsWith('/api') ? base : `${base}/api`) + '/trpc';
};

export const getServerTrpc = (req: Request) =>
  createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        maxItems: 1,
        url: getUrl(),
        transformer: superjson,
        headers: req.headers,
      }),
    ],
  });
