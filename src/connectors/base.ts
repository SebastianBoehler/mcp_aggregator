import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export abstract class BaseConnector {
  protected client: Client | null = null;
  protected connected = false;
  protected toolsCache: Tool[] | null = null;

  abstract connect(): Promise<void>;

  async initialize(): Promise<void> {
    if (!this.client) throw new Error('MCP client is not connected');
    const res = await this.client.listTools();
    this.toolsCache = (res.tools ?? []) as Tool[];
  }

  async callTool(name: string, args: any = {}): Promise<any> {
    if (!this.client) throw new Error('MCP client is not connected');
    return await this.client.callTool({ name, args });
  }

  async listTools(): Promise<Tool[]> {
    if (!this.toolsCache) await this.initialize();
    return this.toolsCache!;
  }

  async cleanup(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    this.connected = false;
  }
}
