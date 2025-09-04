import type { MCPProvider, MCPConnection, MCPProviderConfig, MCPContext, MCPTool } from './types';
import { TRPCError } from '@trpc/server';

export class MCPProviderRegistry {
  private static instance: MCPProviderRegistry;
  private providers = new Map<string, MCPProvider>();
  private connections = new Map<string, MCPConnection>();
  private initialized = false;

  private constructor() { }

  static getInstance(): MCPProviderRegistry {
    if (!MCPProviderRegistry.instance) {
      MCPProviderRegistry.instance = new MCPProviderRegistry();
    }
    return MCPProviderRegistry.instance;
  }

  async initialize(env: unknown): Promise<void> {
    if (this.initialized) return;

    await this.registerDefaultProviders(env);
    this.initialized = true;
  }

  private async registerDefaultProviders(env: unknown): Promise<void> {
    const typedEnv = env as {
      ARCADE_API_KEY?: string;
      COMPOSIO_API_KEY?: string;
      OPENAI_API_KEY?: string;
    };

    if (typedEnv.ARCADE_API_KEY) {
      const { ArcadeProvider } = await import('./providers/arcade');
      const arcadeProvider = new ArcadeProvider();
      await arcadeProvider.init({ apiKey: typedEnv.ARCADE_API_KEY });
      this.register(arcadeProvider);
    }

    if (typedEnv.COMPOSIO_API_KEY) {
      const { ComposioProvider } = await import('./providers/composio');
      const composioProvider = new ComposioProvider();
      await composioProvider.init({
        apiKey: typedEnv.COMPOSIO_API_KEY,
        options: {
          openaiApiKey: typedEnv.OPENAI_API_KEY,
        },
      });
      this.register(composioProvider);
    }
  }

  register(provider: MCPProvider): void {
    if (this.providers.has(provider.name)) {
      console.warn(`Provider ${provider.name} already registered, replacing...`);
    }
    this.providers.set(provider.name, provider);
    console.log(`Registered MCP provider: ${provider.name} v${provider.version}`);
  }

  unregister(name: string): boolean {
    return this.providers.delete(name);
  }

  getProvider(name: string): MCPProvider | undefined {
    return this.providers.get(name);
  }

  getAllProviders(): MCPProvider[] {
    return Array.from(this.providers.values());
  }

  getProvidersByType(type: string): MCPProvider[] {
    return this.getAllProviders().filter((p) => p.type === type);
  }

  async connectProvider(
    providerName: string,
    userId: string,
    config?: MCPProviderConfig,
  ): Promise<MCPConnection> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Provider ${providerName} not found`,
      });
    }

    if (config) {
      await provider.init(config);
    }

    const connection = await provider.connect(userId);
    this.connections.set(connection.id, connection);
    return connection;
  }

  async disconnectProvider(providerName: string, connectionId: string): Promise<void> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Provider ${providerName} not found`,
      });
    }

    await provider.disconnect(connectionId);
    this.connections.delete(connectionId);
  }

  async executeProviderTool(
    providerName: string,
    toolName: string,
    params: unknown,
    context: MCPContext,
  ): Promise<unknown> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Provider ${providerName} not found`,
      });
    }

    return provider.executeTool(toolName, params, context);
  }

  async getAllTools(userId?: string): Promise<MCPTool[]> {
    const allTools: MCPTool[] = [];

    for (const provider of this.providers.values()) {
      try {
        const tools = await provider.listTools(userId);
        allTools.push(...tools);
      } catch (error) {
        console.error(`Failed to get tools from provider ${provider.name}:`, error);
      }
    }

    return allTools;
  }

  async healthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [name, provider] of this.providers) {
      try {
        const healthy = await provider.healthCheck();
        results.set(name, healthy);
      } catch (error) {
        console.error(`Health check failed for provider ${name}:`, error);
        results.set(name, false);
      }
    }

    return results;
  }
}

export const mcpRegistry = MCPProviderRegistry.getInstance();
