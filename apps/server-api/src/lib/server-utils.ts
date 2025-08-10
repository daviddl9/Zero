import { env } from '../env';

export const getZeroDB = async (userId: string) => {
  const response = await env.WORKER_SERVICE.fetch(new Request(`http://worker/internal/zero-db/${userId}`));
  if (!response.ok) {
    throw new Error('Failed to get ZeroDB');
  }
  return await response.json();
};

export const getZeroAgent = async (connectionId: string, _executionCtx?: ExecutionContext) => {
  const response = await env.WORKER_SERVICE.fetch(new Request(`http://worker/internal/zero-agent/${connectionId}`));
  if (!response.ok) {
    throw new Error('Failed to get ZeroAgent');
  }
  return await response.json();
};

export const getActiveConnection = async () => {
  const response = await env.WORKER_SERVICE.fetch(new Request('http://worker/internal/active-connection'));
  if (!response.ok) {
    throw new Error('Failed to get active connection');
  }
  return await response.json();
};

export const verifyToken = async (token: string) => {
  const response = await env.WORKER_SERVICE.fetch(new Request('http://worker/internal/verify-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  }));
  if (!response.ok) {
    throw new Error('Failed to verify token');
  }
  return await response.json();
};

export const connectionToDriver = async (connectionId: string) => {
  const response = await env.WORKER_SERVICE.fetch(new Request(`http://worker/internal/connection-driver/${connectionId}`));
  if (!response.ok) {
    throw new Error('Failed to get connection driver');
  }
  return await response.json();
};

export const getZeroSocketAgent = async (connectionId: string) => {
  const response = await env.WORKER_SERVICE.fetch(new Request(`http://worker/internal/socket-agent/${connectionId}`));
  if (!response.ok) {
    throw new Error('Failed to get socket agent');
  }
  return await response.json();
};

export const reSyncThread = async (connectionId: string, threadId: string) => {
  const response = await env.WORKER_SERVICE.fetch(new Request('http://worker/internal/resync-thread', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectionId, threadId }),
  }));
  if (!response.ok) {
    throw new Error('Failed to resync thread');
  }
  return await response.json();
};

export const forceReSync = () => {};
export const getThreadsFromDB = () => [];
export const getThread = () => ({});
export const modifyThreadLabelsInDB = () => {};
export const deleteAllSpam = () => {};
