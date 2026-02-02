import { describe, it, expect, vi } from 'vitest';

// Mock the AI client resolver to avoid Cloudflare Workers dependency
vi.mock('../ai-client-resolver', () => ({
  resolveAIClient: vi.fn().mockResolvedValue({
    provider: 'gemini',
    google: vi.fn(),
    defaultModel: 'gemini-pro',
    summarizationModel: 'gemini-flash',
    isUserConfigured: false,
  }),
  getSummarizationModel: vi.fn().mockReturnValue('mock-model'),
}));

// Mock ai module
vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      category: 'promotional',
      reasoning: 'This email contains promotional content with discount offers.',
    },
  }),
}));

import { ConditionEvaluator } from './conditions';
import type { TriggerData } from './types';

describe('ConditionEvaluator', () => {
  const evaluator = new ConditionEvaluator();

  describe('evaluateSenderMatch', () => {
    const triggerData: TriggerData = {
      threadId: 'thread-1',
      sender: 'newsletter@example.com',
      subject: 'Weekly Update',
    };

    it('should match exact sender', () => {
      const result = evaluator.evaluateSenderMatch(triggerData, {
        pattern: 'newsletter@example.com',
      });
      expect(result).toBe(true);
    });

    it('should match glob pattern with wildcard', () => {
      const result = evaluator.evaluateSenderMatch(triggerData, {
        pattern: '*@example.com',
      });
      expect(result).toBe(true);
    });

    it('should not match non-matching pattern', () => {
      const result = evaluator.evaluateSenderMatch(triggerData, {
        pattern: '*@other.com',
      });
      expect(result).toBe(false);
    });

    it('should handle missing sender gracefully', () => {
      const result = evaluator.evaluateSenderMatch({ threadId: 't1' }, {
        pattern: '*@example.com',
      });
      expect(result).toBe(false);
    });
  });

  describe('evaluateSubjectMatch', () => {
    const triggerData: TriggerData = {
      threadId: 'thread-1',
      subject: 'URGENT: Please respond immediately',
    };

    it('should match pattern in subject', () => {
      const result = evaluator.evaluateSubjectMatch(triggerData, {
        pattern: 'URGENT*',
      });
      expect(result).toBe(true);
    });

    it('should match case-insensitive', () => {
      const result = evaluator.evaluateSubjectMatch(triggerData, {
        pattern: '*urgent*',
      });
      expect(result).toBe(true);
    });

    it('should not match non-matching pattern', () => {
      const result = evaluator.evaluateSubjectMatch(triggerData, {
        pattern: 'newsletter*',
      });
      expect(result).toBe(false);
    });
  });

  describe('evaluateLabelMatch', () => {
    const triggerData: TriggerData = {
      threadId: 'thread-1',
      labels: ['INBOX', 'IMPORTANT', 'work'],
    };

    it('should match when any label matches (mode: any)', () => {
      const result = evaluator.evaluateLabelMatch(triggerData, {
        labels: ['IMPORTANT', 'STARRED'],
        mode: 'any',
      });
      expect(result).toBe(true);
    });

    it('should not match when no labels match (mode: any)', () => {
      const result = evaluator.evaluateLabelMatch(triggerData, {
        labels: ['SPAM', 'STARRED'],
        mode: 'any',
      });
      expect(result).toBe(false);
    });

    it('should match when all labels match (mode: all)', () => {
      const result = evaluator.evaluateLabelMatch(triggerData, {
        labels: ['INBOX', 'IMPORTANT'],
        mode: 'all',
      });
      expect(result).toBe(true);
    });

    it('should not match when not all labels match (mode: all)', () => {
      const result = evaluator.evaluateLabelMatch(triggerData, {
        labels: ['INBOX', 'STARRED'],
        mode: 'all',
      });
      expect(result).toBe(false);
    });

    it('should handle missing labels gracefully', () => {
      const result = evaluator.evaluateLabelMatch({ threadId: 't1' }, {
        labels: ['INBOX'],
        mode: 'any',
      });
      expect(result).toBe(false);
    });
  });

  describe('evaluateKeywordMatch', () => {
    const triggerData: TriggerData = {
      threadId: 'thread-1',
      subject: 'Meeting Tomorrow',
      snippet: 'Please join us for the quarterly review meeting at 3pm.',
    };

    it('should match keyword in subject', () => {
      const result = evaluator.evaluateKeywordMatch(triggerData, {
        keywords: ['meeting'],
        location: 'subject',
      });
      expect(result).toBe(true);
    });

    it('should match keyword in body/snippet', () => {
      const result = evaluator.evaluateKeywordMatch(triggerData, {
        keywords: ['quarterly', 'review'],
        location: 'body',
      });
      expect(result).toBe(true);
    });

    it('should match keyword in both subject and body', () => {
      const result = evaluator.evaluateKeywordMatch(triggerData, {
        keywords: ['meeting'],
        location: 'both',
      });
      expect(result).toBe(true);
    });

    it('should be case-insensitive', () => {
      const result = evaluator.evaluateKeywordMatch(triggerData, {
        keywords: ['MEETING', 'QUARTERLY'],
        location: 'both',
      });
      expect(result).toBe(true);
    });

    it('should not match when keyword not present', () => {
      const result = evaluator.evaluateKeywordMatch(triggerData, {
        keywords: ['urgent', 'important'],
        location: 'both',
      });
      expect(result).toBe(false);
    });
  });

  describe('evaluate (main dispatcher)', () => {
    it('should dispatch to correct evaluator based on condition type', () => {
      const triggerData: TriggerData = {
        threadId: 't1',
        sender: 'test@example.com',
      };

      const result = evaluator.evaluate('sender_match', triggerData, {
        pattern: '*@example.com',
      });
      expect(result).toBe(true);
    });

    it('should return false for unknown condition type', () => {
      const result = evaluator.evaluate('unknown_condition', { threadId: 't1' }, {});
      expect(result).toBe(false);
    });
  });

  describe('evaluateAsync', () => {
    it('should return ConditionResult with outputIndex for ai_classification', async () => {
      const triggerData: TriggerData = {
        threadId: 't1',
        subject: 'Big Sale! 50% off!',
        sender: 'promo@store.com',
        snippet: 'Check out our amazing deals!',
      };

      const mockEnv = { GOOGLE_GENERATIVE_AI_API_KEY: 'test-key' } as any;

      const result = await evaluator.evaluateAsync(
        'ai_classification',
        triggerData,
        { categories: ['promotional', 'for info', 'requires follow up', 'newsletter'] },
        'user-123',
        mockEnv,
      );

      expect(result.passed).toBe(true);
      expect(result.outputIndex).toBeDefined();
      expect(result.category).toBeDefined();
    });

    it('should return "other" category when userId or env is missing', async () => {
      const triggerData: TriggerData = {
        threadId: 't1',
        subject: 'Test',
      };

      const result = await evaluator.evaluateAsync(
        'ai_classification',
        triggerData,
        { categories: ['promotional', 'newsletter'] },
      );

      expect(result.passed).toBe(true);
      expect(result.outputIndex).toBe(2); // categories.length = "other" index
      expect(result.category).toBe('other');
    });

    it('should convert boolean conditions to ConditionResult', async () => {
      const triggerData: TriggerData = {
        threadId: 't1',
        sender: 'test@example.com',
      };

      const result = await evaluator.evaluateAsync(
        'sender_match',
        triggerData,
        { pattern: '*@example.com' },
      );

      expect(result.passed).toBe(true);
      expect(result.outputIndex).toBe(0);
    });

    it('should return passed=false for failed boolean conditions', async () => {
      const triggerData: TriggerData = {
        threadId: 't1',
        sender: 'test@other.com',
      };

      const result = await evaluator.evaluateAsync(
        'sender_match',
        triggerData,
        { pattern: '*@example.com' },
      );

      expect(result.passed).toBe(false);
      expect(result.outputIndex).toBeUndefined();
    });
  });
});
