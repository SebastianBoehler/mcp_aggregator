import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { BaseConnector } from './base';

export class HttpConnector extends BaseConnector {
  constructor(private baseUrl: string, private opts: { headers?: Record<string, string>; authToken?: string } = {}) {
    super();
    if (this.opts.authToken) {
      this.opts.headers = { ...(this.opts.headers ?? {}), Authorization: `Bearer ${this.opts.authToken}` };
    }
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    const transport = new SSEClientTransport(new URL(this.baseUrl.replace(/\/$/, '') + '/mcp'), {
      requestInit: { headers: this.opts.headers },
    });
    this.client = new Client({ name: 'http-connector', version: '1.0.0' });
    await this.client.connect(transport);
    this.connected = true;
  }
}
