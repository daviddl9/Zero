/**
 * Subscription Renewal Job
 *
 * BullMQ job for renewing Gmail push notification subscriptions.
 * Gmail subscriptions expire after 7 days, so we renew them every 5 days.
 */

import type { Job } from 'bullmq';
import type { SubscriptionRenewalJobData, SubscriptionRenewalResult } from './types';

/**
 * Process a subscription renewal job
 */
export async function processSubscriptionRenewalJob(
  job: Job<SubscriptionRenewalJobData>,
): Promise<SubscriptionRenewalResult> {
  const { userId: _userId, connectionId, email } = job.data;

  console.log(`[SubscriptionRenewalJob] Renewing subscription for ${email} (${connectionId})`);

  try {
    job.updateProgress(10);

    // Placeholder - actual implementation in standalone server
    const result: SubscriptionRenewalResult = {
      historyId: 'placeholder',
      expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    job.updateProgress(100);
    console.log(`[SubscriptionRenewalJob] Subscription renewed for ${email}`);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SubscriptionRenewalJob] Failed to renew subscription for ${email}:`, errorMessage);
    throw error;
  }
}

/**
 * Create the subscription renewal processor with dependencies injected
 */
export function createSubscriptionRenewalProcessor(deps: {
  getConnection: (connectionId: string) => Promise<{
    id: string;
    userId: string;
    email: string;
    accessToken: string;
    refreshToken: string;
  } | null>;
  watchMailbox: (connectionId: string) => Promise<{
    historyId: string;
    expiration: string;
  }>;
  getSubscriptionAge: (connectionId: string) => Promise<number | null>;
  setSubscriptionAge: (connectionId: string, timestamp: number) => Promise<void>;
}) {
  return async (job: Job<SubscriptionRenewalJobData>): Promise<SubscriptionRenewalResult> => {
    const { connectionId, email } = job.data;

    console.log(`[SubscriptionRenewalJob] Processing renewal for ${email}`);

    try {
      job.updateProgress(10);

      // Check if renewal is needed (every 5 days)
      const lastRenewal = await deps.getSubscriptionAge(connectionId);
      const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;

      if (lastRenewal && Date.now() - lastRenewal < fiveDaysMs) {
        console.log(`[SubscriptionRenewalJob] Subscription still valid for ${email}, skipping`);
        return {
          historyId: 'skipped',
          expiration: new Date(lastRenewal + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };
      }

      job.updateProgress(30);

      // Get connection to verify it exists
      const connection = await deps.getConnection(connectionId);
      if (!connection) {
        throw new Error(`Connection ${connectionId} not found`);
      }

      job.updateProgress(50);

      // Watch mailbox (creates or renews subscription)
      const watchResult = await deps.watchMailbox(connectionId);

      job.updateProgress(80);

      // Update subscription age
      await deps.setSubscriptionAge(connectionId, Date.now());

      job.updateProgress(100);

      console.log(`[SubscriptionRenewalJob] Subscription renewed for ${email}, expires: ${watchResult.expiration}`);

      return {
        historyId: watchResult.historyId,
        expiration: watchResult.expiration,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[SubscriptionRenewalJob] Failed to renew for ${email}:`, errorMessage);
      throw error;
    }
  };
}
