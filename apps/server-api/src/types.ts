export interface IOutgoingMessage {
  id: string;
  threadId: string;
  subject: string;
  body: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
}

export interface ParsedMessage {
  id: string;
  threadId: string;
  subject: string;
  body: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  date: Date;
  attachments?: Array<{
    filename: string;
    contentType: string;
    size: number;
  }>;
}

export interface ISnoozeBatch {
  emails: Array<{
    id: string;
    snoozeUntil: Date;
  }>;
}

export enum EPrompts {
  SUMMARIZE = 'summarize',
  REPLY = 'reply',
  COMPOSE = 'compose',
  ANALYZE = 'analyze',
}
