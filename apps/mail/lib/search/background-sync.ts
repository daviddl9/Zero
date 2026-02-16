import { useEffect, useRef } from 'react';
import { getSearchDb } from './search-db';
import type { SyncProgress } from './types';

const SYNC_DELAY_MS = 2000;
const CATCHUP_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

interface SyncableThread {
  id: string;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

async function syncFolder<T extends SyncableThread>(
  connectionId: string,
  folder: string,
  fetchThreads: (folder: string, cursor: string) => Promise<{ threads: T[]; nextPageToken: string | null }>,
  indexThreadsBatch: (connId: string, threads: T[]) => Promise<void>,
  signal: AbortSignal,
): Promise<void> {
  const db = getSearchDb(connectionId);
  const syncId = `sync-${folder.toLowerCase()}`;

  let progress: SyncProgress | undefined = await db.syncProgress.get(syncId);

  const isCatchUp = progress?.completed && Date.now() - progress.lastSyncedAt > CATCHUP_THRESHOLD_MS;
  const isResume = progress && !progress.completed;

  let cursor = isResume && progress?.nextPageToken ? progress.nextPageToken : '';
  let totalIndexed = isResume ? (progress?.totalIndexed ?? 0) : 0;

  // If completed and within threshold, skip
  if (progress?.completed && !isCatchUp) return;

  while (true) {
    if (signal.aborted) return;

    const page = await fetchThreads(folder, cursor);
    if (signal.aborted) return;

    if (page.threads.length === 0) break;

    // In catch-up mode, stop early if all threads are already indexed
    if (isCatchUp) {
      const existingIds = await db.threads.where('id').anyOf(page.threads.map((t) => t.id)).primaryKeys();
      if (existingIds.length === page.threads.length) {
        // All threads in this page already indexed — catch-up complete
        await db.syncProgress.put({
          id: syncId,
          folder,
          nextPageToken: null,
          completed: true,
          lastSyncedAt: Date.now(),
          totalIndexed: progress?.totalIndexed ?? totalIndexed,
        });
        return;
      }
    }

    await indexThreadsBatch(connectionId, page.threads);
    totalIndexed += page.threads.length;

    if (!page.nextPageToken) {
      // Reached end of folder
      await db.syncProgress.put({
        id: syncId,
        folder,
        nextPageToken: null,
        completed: true,
        lastSyncedAt: Date.now(),
        totalIndexed,
      });
      return;
    }

    // Save cursor for resume
    cursor = page.nextPageToken;
    await db.syncProgress.put({
      id: syncId,
      folder,
      nextPageToken: cursor,
      completed: false,
      lastSyncedAt: Date.now(),
      totalIndexed,
    });

    await sleep(SYNC_DELAY_MS, signal);
  }

  // If we get here, the loop ended with no threads (empty folder)
  await db.syncProgress.put({
    id: syncId,
    folder,
    nextPageToken: null,
    completed: true,
    lastSyncedAt: Date.now(),
    totalIndexed,
  });
}

const DEFAULT_SYNC_FOLDERS = ['INBOX', 'SENT'];

export function useBackgroundSync<T extends SyncableThread>(
  connectionId: string | null,
  isReady: boolean,
  indexThreadsBatch: (connId: string, threads: T[]) => Promise<void>,
  fetchThreads: (folder: string, cursor: string) => Promise<{ threads: T[]; nextPageToken: string | null }>,
  folders: string[] = DEFAULT_SYNC_FOLDERS,
): void {
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!connectionId || !isReady) return;

    const ac = new AbortController();
    abortRef.current = ac;

    const run = async () => {
      for (const folder of folders) {
        if (ac.signal.aborted) return;
        try {
          await syncFolder(connectionId, folder, fetchThreads, indexThreadsBatch, ac.signal);
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          console.warn(`[BackgroundSync] Error syncing ${folder} folder:`, err);
        }
      }
    };

    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(() => void run());
      return () => {
        cancelIdleCallback(id);
        ac.abort();
        abortRef.current = null;
      };
    } else {
      const timer = setTimeout(() => void run(), 500);
      return () => {
        clearTimeout(timer);
        ac.abort();
        abortRef.current = null;
      };
    }
  }, [connectionId, isReady, indexThreadsBatch, fetchThreads, folders]);
}
