import { generateText } from 'ai';
import type {
  TriggerData,
  SenderMatchParams,
  SubjectMatchParams,
  LabelMatchParams,
  AIClassificationParams,
  KeywordMatchParams,
  ConditionResult,
} from './types';
import { resolveAIClient, getSummarizationModel } from '../ai-client-resolver';
import type { ZeroEnv } from '../../env';

/**
 * Converts a glob-style pattern to a regular expression
 * Supports * for any characters
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
    .replace(/\*/g, '.*'); // Convert * to .*
  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * Condition evaluator for workflow conditions
 */
export class ConditionEvaluator {
  /**
   * Evaluate a sender match condition
   */
  evaluateSenderMatch(triggerData: TriggerData, params: SenderMatchParams): boolean {
    const sender = triggerData.sender;
    if (!sender) return false;

    const regex = globToRegex(params.pattern);
    return regex.test(sender);
  }

  /**
   * Evaluate a subject match condition
   */
  evaluateSubjectMatch(triggerData: TriggerData, params: SubjectMatchParams): boolean {
    const subject = triggerData.subject;
    if (!subject) return false;

    const regex = globToRegex(params.pattern);
    return regex.test(subject);
  }

  /**
   * Evaluate a label match condition
   */
  evaluateLabelMatch(triggerData: TriggerData, params: LabelMatchParams): boolean {
    const labels = triggerData.labels;
    if (!labels || labels.length === 0) return false;

    const mode = params.mode || 'any';
    const targetLabels = params.labels.map((l) => l.toLowerCase());
    const emailLabelsSet = new Set(labels.map((l) => l.toLowerCase()));

    if (mode === 'any') {
      return targetLabels.some((target) => emailLabelsSet.has(target));
    } else {
      // mode === 'all'
      return targetLabels.every((target) => emailLabelsSet.has(target));
    }
  }

  /**
   * Evaluate a keyword match condition
   */
  evaluateKeywordMatch(triggerData: TriggerData, params: KeywordMatchParams): boolean {
    const keywords = params.keywords.map((k) => k.toLowerCase());
    const location = params.location || 'both';

    let searchText = '';

    if (location === 'subject' || location === 'both') {
      searchText += (triggerData.subject || '').toLowerCase() + ' ';
    }

    if (location === 'body' || location === 'both') {
      // Use snippet as body content for now
      searchText += (triggerData.snippet || '').toLowerCase();
    }

    return keywords.some((keyword) => searchText.includes(keyword));
  }

  /**
   * Evaluate an AI classification condition using Gemini/OpenAI
   * Returns which category the email matches (or "other" if none)
   */
  async evaluateAIClassification(
    triggerData: TriggerData,
    params: AIClassificationParams,
    userId: string,
    env: ZeroEnv,
  ): Promise<ConditionResult> {
    try {
      const aiConfig = await resolveAIClient(userId, env);
      const model = getSummarizationModel(aiConfig);

      const categoriesList = params.categories.join(', ');

      const result = await generateText({
        model,
        system: `You are an email classifier. Classify the email into exactly one of these categories: ${categoriesList}, or "other" if none fit well.

Rules:
- Output ONLY the category name, nothing else
- Use lowercase
- If the email clearly fits one category, choose it
- If unsure or no good fit, output "other"`,
        prompt: `Subject: ${triggerData.subject || '(no subject)'}
From: ${triggerData.sender || '(unknown sender)'}
Body: ${triggerData.snippet || '(no content)'}`,
      });

      const category = result.text.trim().toLowerCase();
      const outputIndex = params.categories.findIndex(
        (c) => c.toLowerCase() === category,
      );

      // If no match found, use last index (the "other" output)
      const finalIndex = outputIndex >= 0 ? outputIndex : params.categories.length;
      const matchedCategory = outputIndex >= 0 ? params.categories[outputIndex] : 'other';

      console.log(
        `[AIClassification] Classified as "${matchedCategory}" (outputIndex: ${finalIndex})`,
      );

      return {
        passed: true, // AI classification always "passes" - it just routes
        outputIndex: finalIndex,
        category: matchedCategory,
      };
    } catch (error) {
      console.error('[AIClassification] Error:', error);
      // On error, route to "other" (last output)
      return {
        passed: true,
        outputIndex: params.categories.length,
        category: 'other',
      };
    }
  }

  /**
   * Main evaluation dispatcher
   */
  evaluate(
    conditionType: string,
    triggerData: TriggerData,
    params: Record<string, unknown>,
  ): boolean {
    switch (conditionType) {
      case 'sender_match':
        return this.evaluateSenderMatch(triggerData, params as SenderMatchParams);
      case 'subject_match':
        return this.evaluateSubjectMatch(triggerData, params as SubjectMatchParams);
      case 'label_match':
        return this.evaluateLabelMatch(triggerData, params as LabelMatchParams);
      case 'keyword_match':
        return this.evaluateKeywordMatch(triggerData, params as KeywordMatchParams);
      // AI classification is async, handled separately
      default:
        console.warn(`Unknown condition type: ${conditionType}`);
        return false;
    }
  }

  /**
   * Async evaluation dispatcher (for conditions that may be async like AI)
   * Returns ConditionResult for multi-output routing support
   */
  async evaluateAsync(
    conditionType: string,
    triggerData: TriggerData,
    params: Record<string, unknown>,
    userId?: string,
    env?: ZeroEnv,
  ): Promise<ConditionResult> {
    switch (conditionType) {
      case 'ai_classification':
        if (!userId || !env) {
          console.warn('[AIClassification] Missing userId or env, routing to "other"');
          const categories = (params as AIClassificationParams).categories || [];
          return {
            passed: true,
            outputIndex: categories.length,
            category: 'other',
          };
        }
        return this.evaluateAIClassification(
          triggerData,
          params as AIClassificationParams,
          userId,
          env,
        );
      default: {
        // For non-AI conditions, convert boolean to ConditionResult
        const passed = this.evaluate(conditionType, triggerData, params);
        return {
          passed,
          outputIndex: passed ? 0 : undefined,
        };
      }
    }
  }
}
