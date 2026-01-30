import { type inferRouterInputs, type inferRouterOutputs } from '@trpc/server';
import { cookiePreferencesRouter } from './routes/cookies';
import { connectionsRouter } from './routes/connections';
import { aiSettingsRouter } from './routes/ai-settings';
import { categoriesRouter } from './routes/categories';
import { templatesRouter } from './routes/templates';
import { shortcutRouter } from './routes/shortcut';
import { settingsRouter } from './routes/settings';
import { getContext } from 'hono/context-storage';
import { loggingRouter } from './routes/logging';
import { workflowsRouter } from './routes/workflows';
import { skillsRouter } from './routes/skills';
import { memoryRouter } from './routes/memory';
import { draftsRouter } from './routes/drafts';
import { labelsRouter } from './routes/label';
import { notesRouter } from './routes/notes';
import { userRouter } from './routes/user';
import { meetRouter } from './routes/meet';
import { mailRouter } from './routes/mail';
import { bimiRouter } from './routes/bimi';
import type { HonoContext } from '../ctx';
import { aiRouter } from './routes/ai';
import { router } from './trpc';

export const appRouter = router({
  ai: aiRouter,
  aiSettings: aiSettingsRouter,
  bimi: bimiRouter,
  categories: categoriesRouter,
  connections: connectionsRouter,
  cookiePreferences: cookiePreferencesRouter,
  drafts: draftsRouter,
  labels: labelsRouter,
  mail: mailRouter,
  memory: memoryRouter,
  notes: notesRouter,
  shortcut: shortcutRouter,
  settings: settingsRouter,
  skills: skillsRouter,
  user: userRouter,
  templates: templatesRouter,
  meet: meetRouter,
  logging: loggingRouter,
  workflows: workflowsRouter,
});

export type AppRouter = typeof appRouter;

export type Inputs = inferRouterInputs<AppRouter>;
export type Outputs = inferRouterOutputs<AppRouter>;

export const serverTrpc = () => {
  const c = getContext<HonoContext>();
  return appRouter.createCaller({
    c,
    sessionUser: c.var.sessionUser,
    auth: c.var.auth,
  });
};
