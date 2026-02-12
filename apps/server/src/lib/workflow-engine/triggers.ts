import type { WorkflowNode, TriggerType } from './types';

/**
 * Thread data for trigger evaluation
 */
export interface ThreadData {
  id: string;
  subject: string;
  sender: {
    name?: string;
    email: string;
  };
  labels: Array<{ id: string; name: string }>;
  receivedOn: string;
  unread: boolean;
  body: string;
}

/**
 * Label change event data
 */
export interface LabelChangeData {
  label: string;
  action: 'added' | 'removed';
}

/**
 * Context provided to trigger evaluation
 */
export interface TriggerContext {
  event: 'email_received' | 'email_labeled' | 'schedule';
  thread: ThreadData;
  labelChange?: LabelChangeData;
  scheduledTime?: string;
}

/**
 * Result of evaluating triggers for a workflow
 */
export interface TriggerEvaluationResult {
  triggered: boolean;
  matchedTriggerId?: string;
}

/**
 * Maps trigger node types to event types
 */
const TRIGGER_EVENT_MAP: Record<TriggerType, TriggerContext['event']> = {
  email_received: 'email_received',
  email_labeled: 'email_labeled',
  schedule: 'schedule',
};

/**
 * Evaluates workflow triggers against email events
 */
export class TriggerEvaluator {
  /**
   * Evaluate a single trigger node against a context
   */
  evaluate(trigger: WorkflowNode, context: TriggerContext): boolean {
    // Skip disabled triggers
    if (trigger.disabled) {
      return false;
    }

    // Ensure this is a trigger node
    if (trigger.type !== 'trigger') {
      return false;
    }

    const nodeType = trigger.nodeType as TriggerType;
    const expectedEvent = TRIGGER_EVENT_MAP[nodeType];

    // Unknown trigger type
    if (!expectedEvent) {
      console.warn(`Unknown trigger type: ${nodeType}`);
      return false;
    }

    // Event type must match
    if (context.event !== expectedEvent) {
      return false;
    }

    // Delegate to specific trigger evaluators
    switch (nodeType) {
      case 'email_received':
        return this.evaluateEmailReceived(trigger, context);
      case 'email_labeled':
        return this.evaluateEmailLabeled(trigger, context);
      case 'schedule':
        return this.evaluateSchedule(trigger, context);
      default:
        return false;
    }
  }

  /**
   * Evaluate email_received trigger
   */
  private evaluateEmailReceived(trigger: WorkflowNode, context: TriggerContext): boolean {
    const { parameters } = trigger;
    const { thread } = context;

    // Check folder filter if specified
    if (parameters.folder) {
      const folderName = (parameters.folder as string).toUpperCase();
      const hasLabel = thread.labels.some(
        (label) => label.id.toUpperCase() === folderName || label.name.toUpperCase() === folderName
      );
      if (!hasLabel) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate email_labeled trigger
   */
  private evaluateEmailLabeled(trigger: WorkflowNode, context: TriggerContext): boolean {
    const { parameters } = trigger;
    const { labelChange } = context;

    // Must have label change data
    if (!labelChange) {
      return false;
    }

    // Check label name matches
    const expectedLabel = parameters.label as string;
    if (expectedLabel && labelChange.label !== expectedLabel) {
      return false;
    }

    // Check action matches
    const expectedAction = parameters.action as 'added' | 'removed';
    if (expectedAction && labelChange.action !== expectedAction) {
      return false;
    }

    return true;
  }

  /**
   * Evaluate schedule trigger
   * Note: The actual cron evaluation happens at the scheduler level.
   * This just validates that the event is a scheduled event.
   */
  private evaluateSchedule(_trigger: WorkflowNode, context: TriggerContext): boolean {
    // Schedule triggers match when the event is 'schedule'
    // The cron expression is evaluated by the job scheduler, not here
    return context.event === 'schedule';
  }

  /**
   * Evaluate all triggers in a workflow and return if any match
   */
  evaluateWorkflow(triggers: WorkflowNode[], context: TriggerContext): TriggerEvaluationResult {
    for (const trigger of triggers) {
      if (this.evaluate(trigger, context)) {
        return {
          triggered: true,
          matchedTriggerId: trigger.id,
        };
      }
    }

    return { triggered: false };
  }

  /**
   * Build a trigger context from thread data
   */
  static buildTriggerContext(
    event: TriggerContext['event'],
    threadData: ThreadData,
    labelChange?: LabelChangeData
  ): TriggerContext {
    return {
      event,
      thread: threadData,
      ...(labelChange && { labelChange }),
    };
  }
}
