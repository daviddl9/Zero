/**
 * Send Email Job
 *
 * BullMQ job for sending emails asynchronously.
 * This replaces the Cloudflare send-email-queue functionality.
 */

import type { Job } from 'bullmq';
import type { SendEmailJobData, SendEmailResult } from './types';

/**
 * Process a send email job
 */
export async function processSendEmailJob(job: Job<SendEmailJobData>): Promise<SendEmailResult> {
  const { emailId, userId: _userId, connectionId, to, subject } = job.data;

  console.log(`[SendEmailJob] Processing email ${emailId} for connection ${connectionId}`);
  console.log(`[SendEmailJob] To: ${to.join(', ')}, Subject: ${subject}`);

  try {
    job.updateProgress(10);

    // Placeholder - actual implementation in standalone server
    const result: SendEmailResult = {
      messageId: `msg_${emailId}`,
      threadId: job.data.threadId || `thread_${emailId}`,
      sentAt: new Date().toISOString(),
    };

    job.updateProgress(100);
    console.log(`[SendEmailJob] Email ${emailId} sent successfully`);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SendEmailJob] Failed to send email ${emailId}:`, errorMessage);
    throw error;
  }
}

/**
 * Create the send email processor with dependencies injected
 */
export function createSendEmailProcessor(deps: {
  getConnection: (connectionId: string) => Promise<{
    id: string;
    userId: string;
    email: string;
    accessToken: string;
    refreshToken: string;
  } | null>;
  getDriver: (connection: unknown) => {
    send: (params: {
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      body: string;
      threadId?: string;
      inReplyTo?: string;
      references?: string[];
      attachments?: Array<{
        filename: string;
        contentType: string;
        data: string;
      }>;
    }) => Promise<{
      messageId: string;
      threadId: string;
    }>;
  } | null;
  updateEmailStatus: (
    emailId: string,
    status: 'pending' | 'sending' | 'sent' | 'failed',
    error?: string,
  ) => Promise<void>;
  deleteEmailPayload: (emailId: string) => Promise<void>;
}) {
  return async (job: Job<SendEmailJobData>): Promise<SendEmailResult> => {
    const { emailId, connectionId, to, cc, bcc, subject, body, threadId, inReplyTo, references, attachments } =
      job.data;

    console.log(`[SendEmailJob] Sending email ${emailId} via ${connectionId}`);

    try {
      // Update status to sending
      await deps.updateEmailStatus(emailId, 'sending');
      job.updateProgress(10);

      // Get connection
      const connection = await deps.getConnection(connectionId);
      if (!connection) {
        throw new Error(`Connection ${connectionId} not found`);
      }

      job.updateProgress(20);

      // Get driver
      const driver = deps.getDriver(connection);
      if (!driver) {
        throw new Error(`No driver available for connection ${connectionId}`);
      }

      job.updateProgress(30);

      // Send email
      const sendResult = await driver.send({
        to,
        cc,
        bcc,
        subject,
        body,
        threadId,
        inReplyTo,
        references,
        attachments,
      });

      job.updateProgress(80);

      // Update status to sent
      await deps.updateEmailStatus(emailId, 'sent');

      // Clean up payload
      await deps.deleteEmailPayload(emailId);

      job.updateProgress(100);

      const result: SendEmailResult = {
        messageId: sendResult.messageId,
        threadId: sendResult.threadId,
        sentAt: new Date().toISOString(),
      };

      console.log(`[SendEmailJob] Email ${emailId} sent: messageId=${result.messageId}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[SendEmailJob] Failed to send email ${emailId}:`, errorMessage);

      // Update status to failed
      await deps.updateEmailStatus(emailId, 'failed', errorMessage);

      throw error;
    }
  };
}
