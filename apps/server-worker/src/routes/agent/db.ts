import { DurableObject } from 'cloudflare:workers';
import { type ZeroEnv } from '../../env';

export class ZeroDB extends DurableObject {
  constructor(ctx: DurableObjectState, env: ZeroEnv) {
    super(ctx, env);
  }

  async updateConnection(_connectionId: string, _data: any) {
    return { success: true };
  }

  async getConnection(connectionId: string) {
    return { id: connectionId };
  }

  async getConnections() {
    return [];
  }

  async deleteConnection(_connectionId: string) {
    return { success: true };
  }

  async createConnection(_data: any) {
    return { id: 'new-connection' };
  }

  async getActiveConnection() {
    return { id: 'active-connection' };
  }

  async setActiveConnection(_connectionId: string) {
    return { success: true };
  }
}
