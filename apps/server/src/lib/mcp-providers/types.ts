import type { z } from 'zod';

export type MCPProviderType = 'arcade' | 'claude-desktop' | 'custom' | 'builtin';

export interface MCPProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  credentials?: Record<string, string>;
  options?: Record<string, unknown>;
}

export interface MCPConnection {
  id: string;
  userId: string;
  providerId: string;
  providerType: MCPProviderType;
  status: 'connected' | 'disconnected' | 'error';
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MCPTool {
  name: string;
  qualifiedName?: string;
  description: string;
  inputSchema: z.ZodTypeAny | Record<string, unknown>;
  outputSchema?: z.ZodTypeAny | Record<string, unknown>;
  provider: string;
  category?: string;
  requiredScopes?: string[];
  execute?: (params: unknown, context?: MCPContext) => Promise<unknown>;
}

export interface MCPContext {
  userId: string;
  connectionId?: string;
  env?: unknown;
  metadata?: Record<string, unknown>;
}

export interface MCPProviderStatus {
  healthy: boolean;
  initialized: boolean;
  activeConnections?: number;
  lastError?: string;
}

export interface MCPAuthResponse {
  url?: string;
  authId: string;
  status?: 'pending' | 'completed' | 'error';
}

export interface MCPConnection {
  id: string;
  userId: string;
  provider_id: string;
  provider_type: MCPProviderType;
  status: 'connected' | 'disconnected' | 'error';
  metadata?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  connection_id: string;
}

export interface MCPProvider {
  name: string;
  type: MCPProviderType;
  version: string;
  description: string;

  init(config: MCPProviderConfig): Promise<void>;

  connect(userId: string, connectionId?: string): Promise<MCPConnection>;
  disconnect(connectionId: string): Promise<void>;

  listTools(userId?: string): Promise<MCPTool[]>;
  getTool(toolName: string): Promise<MCPTool | null>;
  executeTool(toolName: string, params: unknown, context: MCPContext): Promise<unknown>;

  getAuthUrl?(userId: string, toolkit?: string, scopes?: string[]): Promise<MCPAuthResponse>;
  handleCallback?(authId: string, params: unknown): Promise<MCPConnection>;
  verifyAuth?(authId: string, flowId?: string): Promise<boolean>;

  healthCheck(): Promise<boolean>;
  getStatus(): MCPProviderStatus;

  listConnections?(userId: string): Promise<MCPConnection[]>;
  revokeConnection?(connectionId: string, userId: string): Promise<void>;
}

export interface ToolkitInfo {
  name: string;
  description: string;
  toolCount: number;
  icon?: string;
  tools?: MCPTool[];
}
