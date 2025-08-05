import type { ParsedMessage } from '@/types';

export interface OTPCode {
  id: string;
  code: string;
  service: string;
  threadId: string;
  from: string;
  subject: string;
  receivedAt: Date;
  expiresAt?: Date;
  isExpired: boolean;
}

// Common OTP patterns
const OTP_PATTERNS = [
  // 6-8 digit codes
  /\b(\d{6,8})\b/,
  // Codes with dashes or spaces
  /\b(\d{3}[-\s]?\d{3})\b/,
  // Alphanumeric codes
  /\b([A-Z0-9]{6,8})\b/,
  // With prefix text
  /(?:code|verification|otp|pin)[\s:]+([A-Z0-9]{4,8})/i,
  /(?:is|:)\s*([A-Z0-9]{4,8})\b/i,
];

// Service detection patterns
const SERVICE_PATTERNS: Record<string, RegExp[]> = {
  Google: [/google/i, /gmail/i, /youtube/i],
  Microsoft: [/microsoft/i, /outlook/i, /office/i, /azure/i],
  Amazon: [/amazon/i, /aws/i],
  Apple: [/apple/i, /icloud/i],
  Facebook: [/facebook/i, /meta/i],
  Twitter: [/twitter/i, /x\.com/i],
  GitHub: [/github/i],
  LinkedIn: [/linkedin/i],
  PayPal: [/paypal/i],
  Stripe: [/stripe/i],
  Discord: [/discord/i],
  Slack: [/slack/i],
  Notion: [/notion/i],
  Vercel: [/vercel/i],
  Cloudflare: [/cloudflare/i],
};

export const detectOTPFromEmail = (message: ParsedMessage): OTPCode | null => {
  if (!message.subject && !message.body) return null;

  // Check if this is likely an OTP email
  const otpKeywords = [
    'verification code',
    'verify',
    'otp',
    'one-time',
    'authentication',
    '2fa',
    'two-factor',
    'security code',
    'confirmation code',
    'access code',
    'login code',
  ];

  const content = `${message.subject} ${message.body}`.toLowerCase();
  const hasOTPKeyword = otpKeywords.some((keyword) => content.includes(keyword));

  if (!hasOTPKeyword) return null;

  // Extract the code
  let code: string | null = null;
  const bodyText = message.body || '';

  for (const pattern of OTP_PATTERNS) {
    const match = bodyText.match(pattern);
    if (match && match[1]) {
      code = match[1].replace(/[-\s]/g, '');
      break;
    }
  }

  if (!code) return null;

  // Detect service
  let service = 'Unknown Service';
  const fromEmail = message.sender?.email || '';
  const fromName = message.sender?.name || '';

  for (const [serviceName, patterns] of Object.entries(SERVICE_PATTERNS)) {
    if (
      patterns.some(
        (pattern) =>
          pattern.test(fromEmail) || pattern.test(fromName) || pattern.test(message.subject || ''),
      )
    ) {
      service = serviceName;
      break;
    }
  }

  // If no known service, try to extract from sender
  if (service === 'Unknown Service' && message.sender?.name) {
    service = message.sender.name.split(' ')[0];
  }

  const receivedAt = new Date(message.receivedOn);
  const expiresAt = new Date(receivedAt.getTime() + 10 * 60 * 1000); // 10 minutes
  const isExpired = new Date() > expiresAt;

  return {
    id: `${message.id}-otp`,
    code,
    service,
    threadId: message.threadId || message.id,
    from: fromEmail,
    subject: message.subject || '',
    receivedAt,
    expiresAt,
    isExpired,
  };
};
