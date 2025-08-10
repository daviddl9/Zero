import type { Autumn } from 'autumn-js';
import type { ZeroEnv } from './env';

type Auth = any;

export type SessionUser = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>['user'];

export type HonoVariables = {
  auth: Auth;
  sessionUser?: SessionUser;
  autumn?: Autumn;
};

export type HonoContext = { Variables: HonoVariables; Bindings: ZeroEnv };

export const createContext = () => ({});
