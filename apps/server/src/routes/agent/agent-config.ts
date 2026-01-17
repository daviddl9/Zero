/**
 * Agent Config Service - manages AI agent persona and guidelines stored in the database.
 * Builds dynamic system prompts by combining base prompts with user-specific configurations.
 */

import { eq } from 'drizzle-orm';
import { agentConfig } from '../../db/schema';
import type { DB } from '../../db';
import type { SkillSummary } from './skills';

export interface AgentConfig {
  id: string;
  userId: string;
  jobDescription: string | null;
  writingStyle: string | null;
  guidelines: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateAgentConfigInput {
  jobDescription?: string | null;
  writingStyle?: string | null;
  guidelines?: string | null;
}

export class AgentConfigService {
  constructor(
    private db: DB,
    private userId: string,
  ) {}

  /**
   * Get the agent config for the user.
   */
  async getConfig(): Promise<AgentConfig | null> {
    const results = await this.db
      .select()
      .from(agentConfig)
      .where(eq(agentConfig.userId, this.userId))
      .limit(1);

    return (results[0] as AgentConfig) || null;
  }

  /**
   * Create or update the agent config for the user.
   */
  async upsertConfig(input: UpdateAgentConfigInput): Promise<AgentConfig> {
    const existing = await this.getConfig();

    if (existing) {
      const updates: Partial<AgentConfig> = {
        updatedAt: new Date(),
      };

      if (input.jobDescription !== undefined) updates.jobDescription = input.jobDescription;
      if (input.writingStyle !== undefined) updates.writingStyle = input.writingStyle;
      if (input.guidelines !== undefined) updates.guidelines = input.guidelines;

      await this.db.update(agentConfig).set(updates).where(eq(agentConfig.userId, this.userId));

      return (await this.getConfig())!;
    }

    const now = new Date();
    const newConfig = {
      id: crypto.randomUUID(),
      userId: this.userId,
      jobDescription: input.jobDescription || null,
      writingStyle: input.writingStyle || null,
      guidelines: input.guidelines || null,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(agentConfig).values(newConfig);
    return newConfig as AgentConfig;
  }

  /**
   * Delete the agent config for the user.
   */
  async deleteConfig(): Promise<boolean> {
    const existing = await this.getConfig();
    if (!existing) return false;

    await this.db.delete(agentConfig).where(eq(agentConfig.userId, this.userId));
    return true;
  }

  /**
   * Build the system prompt by enhancing the base prompt with agent config and skills.
   */
  buildSystemPrompt(basePrompt: string, _skills: SkillSummary[] = []): string {
    let prompt = basePrompt;

    // We need to fetch the config synchronously, but this method is called with already-fetched data
    // So we'll create a static method that builds the prompt with provided config
    return prompt;
  }

  /**
   * Static method to build enhanced system prompt with config and skills.
   */
  static buildEnhancedPrompt(
    basePrompt: string,
    config: AgentConfig | null,
    skills: SkillSummary[] = [],
  ): string {
    const sections: string[] = [basePrompt];

    // Add job description / persona
    if (config?.jobDescription) {
      sections.push(`
      <agent_persona>
        ${config.jobDescription}
      </agent_persona>`);
    }

    // Add writing style guidelines
    if (config?.writingStyle) {
      sections.push(`
      <communication_style>
        ${config.writingStyle}
      </communication_style>`);
    }

    // Add custom guidelines
    if (config?.guidelines) {
      sections.push(`
      <custom_guidelines>
        ${config.guidelines}
      </custom_guidelines>`);
    }

    // Add available skills
    if (skills.length > 0) {
      const skillLines = skills.map((s) => {
        const desc = s.description ? `: ${s.description}` : '';
        const cat = s.category ? ` [${s.category}]` : '';
        return `- ${s.name}${cat}${desc}`;
      });

      sections.push(`
      <available_skills>
        The following skills are available to enhance your capabilities. Use the readSkill tool to load a skill's full instructions when handling a task that matches its description.

        ${skillLines.join('\n        ')}

        <skill_usage>
          1. When a user's request matches a skill's description, use the readSkill tool to load its full instructions
          2. Follow the skill's instructions to complete the task
          3. Skills may contain domain-specific knowledge, workflows, or templates
        </skill_usage>
      </available_skills>`);
    }

    return sections.join('\n');
  }
}
