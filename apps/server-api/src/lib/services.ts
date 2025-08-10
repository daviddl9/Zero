import { env } from '../env';

export const redis = () => {
  return {
    get: async (key: string) => {
      const response = await env.WORKER_SERVICE.fetch(new Request(`http://worker/internal/redis/get/${key}`));
      return response.ok ? await response.json() : null;
    },
    set: async (key: string, value: any) => {
      const response = await env.WORKER_SERVICE.fetch(new Request('http://worker/internal/redis/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      }));
      return response.ok;
    },
    del: async (key: string) => {
      const response = await env.WORKER_SERVICE.fetch(new Request(`http://worker/internal/redis/del/${key}`, {
        method: 'DELETE',
      }));
      return response.ok;
    },
  };
};
