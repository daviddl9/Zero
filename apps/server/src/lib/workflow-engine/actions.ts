import type {
  TriggerData,

  AddLabelParams,
  RemoveLabelParams,
  SendNotificationParams,
  GenerateDraftParams,
  RunSkillParams,
} from './types';

export interface ActionResult {
  success: boolean;
  error?: string;
  output?: unknown;
  dryRun?: boolean;
}

export interface LabelInfo {
  id: string;
  name: string;
}

export interface ActionContext {
  connectionId: string;
  triggerData: TriggerData;
  dryRun?: boolean;
  envVars?: Record<string, string>;
  // Driver methods injected by the executor
  modifyThread: (
    threadId: string,
    options: { addLabels: string[]; removeLabels: string[] },
  ) => Promise<void>;
  getLabels: () => Promise<LabelInfo[]>;
  createDraft?: (options: {
    to: string[];
    subject: string;
    body: string;
    threadId?: string;
  }) => Promise<{ id: string }>;
}

/**
 * Interpolate variables in a message string
 */
function interpolateMessage(
  message: string,
  triggerData: TriggerData,
  envVars?: Record<string, string>,
): string {
  return message.replace(/\{\{\$(\w+)\.(\w+)\}\}/g, (match, source, field) => {
    if (source === 'trigger') {
      const value = (triggerData as Record<string, unknown>)[field];
      return value !== undefined ? String(value) : '';
    }
    if (source === 'env' && envVars) {
      return envVars[field] || '';
    }
    return '';
  });
}

/**
 * Action executor for workflow actions
 */
export class ActionExecutor {
  /**
   * Execute mark as read action
   */
  async executeMarkRead(ctx: ActionContext): Promise<ActionResult> {
    if (ctx.dryRun) {
      return { success: true, dryRun: true, output: 'Would mark as read' };
    }

    console.log(`[ActionExecutor] mark_read: threadId=${ctx.triggerData.threadId}`);
    try {
      await ctx.modifyThread(ctx.triggerData.threadId, {
        addLabels: [],
        removeLabels: ['UNREAD'],
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Execute mark as unread action
   */
  async executeMarkUnread(ctx: ActionContext): Promise<ActionResult> {
    if (ctx.dryRun) {
      return { success: true, dryRun: true, output: 'Would mark as unread' };
    }

    try {
      await ctx.modifyThread(ctx.triggerData.threadId, {
        addLabels: ['UNREAD'],
        removeLabels: [],
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Execute add label action
   */
  async executeAddLabel(ctx: ActionContext, params: AddLabelParams): Promise<ActionResult> {
    if (ctx.dryRun) {
      return { success: true, dryRun: true, output: `Would add label: ${params.label}` };
    }

    try {
      // Look up label ID by name
      const labels = await ctx.getLabels();
      const label = labels.find(
        (l) => l.name.toLowerCase() === params.label.toLowerCase(),
      );

      if (!label) {
        return { success: false, error: `Label '${params.label}' not found` };
      }

      await ctx.modifyThread(ctx.triggerData.threadId, {
        addLabels: [label.id],
        removeLabels: [],
      });
      return { success: true, output: { labelId: label.id } };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Execute remove label action
   */
  async executeRemoveLabel(ctx: ActionContext, params: RemoveLabelParams): Promise<ActionResult> {
    if (ctx.dryRun) {
      return { success: true, dryRun: true, output: `Would remove label: ${params.label}` };
    }

    try {
      // Look up label ID by name
      const labels = await ctx.getLabels();
      const label = labels.find(
        (l) => l.name.toLowerCase() === params.label.toLowerCase(),
      );

      if (!label) {
        return { success: false, error: `Label '${params.label}' not found` };
      }

      await ctx.modifyThread(ctx.triggerData.threadId, {
        addLabels: [],
        removeLabels: [label.id],
      });
      return { success: true, output: { labelId: label.id } };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Execute archive action (removes from INBOX)
   */
  async executeArchive(ctx: ActionContext): Promise<ActionResult> {
    if (ctx.dryRun) {
      return { success: true, dryRun: true, output: 'Would archive' };
    }

    try {
      await ctx.modifyThread(ctx.triggerData.threadId, {
        addLabels: [],
        removeLabels: ['INBOX'],
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Execute send notification action
   */
  async executeSendNotification(
    ctx: ActionContext,
    params: SendNotificationParams,
  ): Promise<ActionResult> {
    const message = interpolateMessage(params.message, ctx.triggerData, ctx.envVars);

    if (ctx.dryRun) {
      return {
        success: true,
        dryRun: true,
        output: { provider: params.provider, message },
      };
    }

    try {
      switch (params.provider) {
        case 'webhook': {
          const config = params.config as { url: string; method?: string; headers?: Record<string, string> };
          const method = config.method || 'POST';
          const response = await fetch(config.url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...config.headers,
            },
            ...(method !== 'GET' && {
              body: JSON.stringify({
                message,
                trigger: ctx.triggerData,
              }),
            }),
          });

          if (!response.ok) {
            return {
              success: false,
              error: `Webhook failed: ${response.status} ${response.statusText}`,
            };
          }

          return { success: true, output: { status: response.status } };
        }

        case 'slack': {
          const config = params.config as { webhookUrl: string; channel?: string };
          const response = await fetch(config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: message,
              channel: config.channel,
            }),
          });

          if (!response.ok) {
            return {
              success: false,
              error: `Slack notification failed: ${response.status}`,
            };
          }

          return { success: true };
        }

        case 'telegram': {
          const config = params.config as { botToken: string; chatId: string };
          const response = await fetch(
            `https://api.telegram.org/bot${config.botToken}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: config.chatId,
                text: message,
              }),
            },
          );

          if (!response.ok) {
            return {
              success: false,
              error: `Telegram notification failed: ${response.status}`,
            };
          }

          return { success: true };
        }

        default:
          return { success: false, error: `Unknown notification provider: ${params.provider}` };
      }
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Execute generate draft action
   * NOTE: This is a placeholder - actual implementation will use the drafting agent
   */
  async executeGenerateDraft(
    ctx: ActionContext,
    params: GenerateDraftParams,
  ): Promise<ActionResult> {
    if (ctx.dryRun) {
      return {
        success: true,
        dryRun: true,
        output: `Would generate draft using skill: ${params.skillId || 'default'}`,
      };
    }

    // TODO: Implement actual draft generation using DraftingAgent
    console.log('[GenerateDraft] Not yet implemented');
    return {
      success: false,
      error: 'Generate draft action not yet implemented',
    };
  }

  /**
   * Execute run skill action
   * NOTE: This is a placeholder - actual implementation will run the skill
   */
  async executeRunSkill(ctx: ActionContext, params: RunSkillParams): Promise<ActionResult> {
    if (ctx.dryRun) {
      return {
        success: true,
        dryRun: true,
        output: `Would run skill: ${params.skillId}`,
      };
    }

    // TODO: Implement actual skill execution
    console.log(`[RunSkill] Not yet implemented: ${params.skillId}`);
    return {
      success: false,
      error: 'Run skill action not yet implemented',
    };
  }

  /**
   * Main execution dispatcher
   */
  async execute(
    actionType: string,
    ctx: ActionContext,
    params: Record<string, unknown>,
  ): Promise<ActionResult> {
    switch (actionType) {
      case 'mark_read':
        return this.executeMarkRead(ctx);
      case 'mark_unread':
        return this.executeMarkUnread(ctx);
      case 'add_label':
        return this.executeAddLabel(ctx, params as AddLabelParams);
      case 'remove_label':
        return this.executeRemoveLabel(ctx, params as RemoveLabelParams);
      case 'archive':
        return this.executeArchive(ctx);
      case 'send_notification':
        return this.executeSendNotification(ctx, params as SendNotificationParams);
      case 'generate_draft':
        return this.executeGenerateDraft(ctx, params as GenerateDraftParams);
      case 'run_skill':
        return this.executeRunSkill(ctx, params as RunSkillParams);
      default:
        return { success: false, error: `Unknown action type: ${actionType}` };
    }
  }
}
