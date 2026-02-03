/**
 * Job type definitions for BullMQ
 *
 * These types define the data structures for all background jobs
 * that replace Cloudflare Workflows functionality.
 */

export const JOB_NAMES = {
  SYNC_THREADS: 'sync-threads',
  SYNC_COORDINATOR: 'sync-coordinator',
  SEND_EMAIL: 'send-email',
  SUBSCRIPTION_RENEWAL: 'subscription-renewal',
  PROCESS_SCHEDULED_EMAILS: 'process-scheduled-emails',
  CLEANUP_WORKFLOW_EXECUTIONS: 'cleanup-workflow-executions',
  THREAD_WORKFLOW: 'thread-workflow',
  POLL_NEW_EMAILS: 'poll-new-emails',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

/**
 * Data for syncing Gmail threads for a specific user/connection
 */
export interface SyncThreadsJobData {
  userId: string;
  connectionId: string;
  historyId?: string;
  pageToken?: string;
  fullSync?: boolean;
  maxResults?: number;
}

/**
 * Data for coordinating multi-page thread syncs
 */
export interface SyncCoordinatorJobData {
  userId: string;
  connectionId: string;
  triggerType: 'full_sync' | 'history_sync' | 'pubsub';
  historyId?: string;
}

/**
 * Data for sending an email
 */
export interface SendEmailJobData {
  emailId: string;
  userId: string;
  connectionId: string;
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
    data: string; // base64 encoded
  }>;
}

/**
 * Data for Gmail subscription renewal
 */
export interface SubscriptionRenewalJobData {
  userId: string;
  connectionId: string;
  email: string;
}

/**
 * Data for processing scheduled emails
 */
export interface ProcessScheduledEmailsJobData {
  batchSize?: number;
  windowHours?: number;
}

/**
 * Data for cleaning up old workflow executions
 */
export interface CleanupWorkflowExecutionsJobData {
  retentionDays?: number;
}

/**
 * Data for running a workflow on a specific thread
 */
export interface ThreadWorkflowJobData {
  userId: string;
  connectionId: string;
  threadId: string;
  messageId?: string;
  triggerType: 'email_received' | 'email_labeled' | 'schedule';
  labels?: string[];
  addedLabels?: string[];
  removedLabels?: string[];
}

/**
 * Data for polling Gmail for new emails (standalone mode)
 * No data needed - job processes all active connections
 */
export interface PollNewEmailsJobData {
  // Empty - processes all connections
}

/**
 * Union type of all job data types
 */
export type JobData =
  | SyncThreadsJobData
  | SyncCoordinatorJobData
  | SendEmailJobData
  | SubscriptionRenewalJobData
  | ProcessScheduledEmailsJobData
  | CleanupWorkflowExecutionsJobData
  | ThreadWorkflowJobData
  | PollNewEmailsJobData;

/**
 * Job result types
 */
export interface SyncThreadsResult {
  syncedThreads: number;
  nextPageToken?: string;
  hasMore: boolean;
  errors?: string[];
}

export interface SyncCoordinatorResult {
  totalPages: number;
  totalThreads: number;
  completedAt: string;
}

export interface SendEmailResult {
  messageId: string;
  threadId: string;
  sentAt: string;
}

export interface SubscriptionRenewalResult {
  historyId: string;
  expiration: string;
}

export interface PollNewEmailsResult {
  connectionsProcessed: number;
  newThreadsFound: number;
  errors?: string[];
}

/**
 * Job options for BullMQ
 */
export interface JobOptions {
  attempts?: number;
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
  delay?: number;
  priority?: number;
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

/**
 * Default job options by job type
 */
export const DEFAULT_JOB_OPTIONS: Record<JobName, JobOptions> = {
  [JOB_NAMES.SYNC_THREADS]: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
  [JOB_NAMES.SYNC_COORDINATOR]: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: 50,
    removeOnFail: 50,
  },
  [JOB_NAMES.SEND_EMAIL]: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 1000,
    removeOnFail: 100,
  },
  [JOB_NAMES.SUBSCRIPTION_RENEWAL]: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60000 },
    removeOnComplete: 50,
    removeOnFail: 50,
  },
  [JOB_NAMES.PROCESS_SCHEDULED_EMAILS]: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 30000 },
    removeOnComplete: 10,
    removeOnFail: 10,
  },
  [JOB_NAMES.CLEANUP_WORKFLOW_EXECUTIONS]: {
    attempts: 1,
    removeOnComplete: 5,
    removeOnFail: 5,
  },
  [JOB_NAMES.THREAD_WORKFLOW]: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 500,
    removeOnFail: 100,
  },
  [JOB_NAMES.POLL_NEW_EMAILS]: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 30000 },
    removeOnComplete: 10,
    removeOnFail: 10,
  },
};
