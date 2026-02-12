import type { ParsedQuery } from './types';

const UNSUPPORTED_OPERATORS = ['has:attachment', 'filename:', 'larger:', 'smaller:', 'in:', 'label:'];

export function parseSearchQuery(raw: string): ParsedQuery {
  const result: ParsedQuery = {
    freeText: '',
    unsupported: [],
  };

  const parts: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i]!;
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === ' ' && !inQuotes) {
      if (current) parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);

  const freeTextParts: string[] = [];

  for (const part of parts) {
    const lower = part.toLowerCase();

    if (lower.startsWith('from:')) {
      result.from = stripQuotes(part.slice(5));
    } else if (lower.startsWith('to:')) {
      result.to = stripQuotes(part.slice(3));
    } else if (lower.startsWith('subject:')) {
      result.subject = stripQuotes(part.slice(8));
    } else if (lower === 'is:unread') {
      result.isUnread = true;
    } else if (lower === 'is:starred') {
      result.isStarred = true;
    } else if (lower.startsWith('after:')) {
      result.after = part.slice(6);
    } else if (lower.startsWith('before:')) {
      result.before = part.slice(7);
    } else if (UNSUPPORTED_OPERATORS.some((op) => lower.startsWith(op))) {
      result.unsupported.push(part);
    } else {
      freeTextParts.push(stripQuotes(part));
    }
  }

  result.freeText = freeTextParts.join(' ').trim();
  return result;
}

function stripQuotes(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1);
  }
  return s;
}

export function hasUnsupportedOperators(query: ParsedQuery): boolean {
  return query.unsupported.length > 0;
}
