import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { trpcServer } from '@hono/trpc-server';
import { appRouter } from './trpc';
import { createContext } from './ctx';
import { publicRouter as authRouter } from './routes/auth';
import { type ApiEnv, setEnv } from './env';

type HonoEnv = { Bindings: ApiEnv };

const app = new Hono<HonoEnv>();

app.use('*', cors({
  origin: (origin: string) => {
    if (!origin) return true;
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://mail.zero.dev',
      'https://zero.dev',
    ];
    return allowedOrigins.includes(origin);
  },
  credentials: true,
}));

app.use('/trpc/*', async (c: any, next: any) => {
  setEnv(c.env);
  return trpcServer({
    router: appRouter,
    createContext: (opts: any) => createContext(opts, c),
  })(c, next);
});

app.route('/auth', authRouter);

app.get('/', (c: any) => {
  return c.text('Zero API Server');
});

app.get('/health', (c: any) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default {
  fetch: app.fetch,
};
