/**
 * Scheduled Emails Job
 *
 * BullMQ job for processing scheduled emails that are due to be sent.
 * This replaces the Cloudflare cron trigger for scheduled emails.
 */

import type { Job } from 'bullmq';
import { addJob } from '../queue';
import { JOB_NAMES, type ProcessScheduledEmailsJobData, type SendEmailJobData } from './types';

/**
 * Process scheduled emails job
 */
export async function processScheduledEmailsJob(
  job: Job<ProcessScheduledEmailsJobData>,
): Promise<{ processed: number; queued: number }> {
  const { batchSize = 50, windowHours = 12 } = job.data;

  console.log(`[ScheduledEmailsJob] Processing scheduled emails (batch: ${batchSize}, window: ${windowHours}h)`);

  try {
    job.updateProgress(10);

    // Placeholder - actual implementation in standalone server
    const result = {
      processed: 0,
      queued: 0,
    };

    job.updateProgress(100);
    console.log(`[ScheduledEmailsJob] Completed: ${result.queued} emails queued`);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ScheduledEmailsJob] Failed:`, errorMessage);
    throw error;
  }
}

/**
 * Create the scheduled emails processor with dependencies injected
 */
export function createScheduledEmailsProcessor(deps: {
  getScheduledEmails: (params: {
    beforeTime: Date;
    limit: number;
  }) => Promise<
    Array<{
      id: string;
      userId: string;
      connectionId: string;
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      body: string;
      threadId?: string;
      scheduledFor: Date;
    }>
  >;
  markEmailAsQueued: (emailId: string) => Promise<void>;
}) {
  return async (
    job: Job<ProcessScheduledEmailsJobData>,
  ): Promise<{ processed: number; queued: number }> => {
    const { batchSize = 50, windowHours = 12 } = job.data;

    console.log(`[ScheduledEmailsJob] Checking for emails due within ${windowHours} hours`);

    const result = {
      processed: 0,
      queued: 0,
    };

    try {
      job.updateProgress(10);

      // Get emails scheduled within the window
      const windowEnd = new Date(Date.now() + windowHours * 60 * 60 * 1000);
      const scheduledEmails = await deps.getScheduledEmails({
        beforeTime: windowEnd,
        limit: batchSize,
      });

      result.processed = scheduledEmails.length;

      if (scheduledEmails.length === 0) {
        console.log(`[ScheduledEmailsJob] No scheduled emails found`);
        job.updateProgress(100);
        return result;
      }

      job.updateProgress(30);

      // Queue each email for sending
      for (const email of scheduledEmails) {
        try {
          // Calculate delay until scheduled time
          const delay = Math.max(0, email.scheduledFor.getTime() - Date.now());

          await addJob<SendEmailJobData>(
            JOB_NAMES.SEND_EMAIL,
            {
              emailId: email.id,
              userId: email.userId,
              connectionId: email.connectionId,
              to: email.to,
              cc: email.cc,
              bcc: email.bcc,
              subject: email.subject,
              body: email.body,
              threadId: email.threadId,
            },
            { delay },
          );

          await deps.markEmailAsQueued(email.id);
          result.queued++;

          console.log(
            `[ScheduledEmailsJob] Queued email ${email.id} with delay ${delay}ms`,
          );
        } catch (error) {
          console.error(`[ScheduledEmailsJob] Failed to queue email ${email.id}:`, error);
        }
      }

      job.updateProgress(100);
      console.log(`[ScheduledEmailsJob] Queued ${result.queued}/${result.processed} emails`);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[ScheduledEmailsJob] Failed:`, errorMessage);
      throw error;
    }
  };
}
