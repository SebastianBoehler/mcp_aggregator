import { spawn, ChildProcess } from 'child_process';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { BaseConnector } from './base';

export interface StdioConnectorOptions {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

export class StdioConnector extends BaseConnector {
  private child: ChildProcess | null = null;
  private baseUrl: string;
  constructor(private options: StdioConnectorOptions) {
    super();
    this.baseUrl = options.url ?? 'http://127.0.0.1:0';
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    const urlObj = new URL(this.baseUrl);
    const port = Number(urlObj.port) || 0;
    const env = { ...process.env, ...(this.options.env ?? {}), PORT: String(port) };
    this.child = spawn(this.options.command, this.options.args ?? [], { env, stdio: 'inherit' });

    const deadline = Date.now() + 10000;
    let ready = false;
    while (!ready && Date.now() < deadline) {
      try {
        const res = await fetch(urlObj.href + '/openapi.json');
        if (res.ok) ready = true;
      } catch {}
      if (!ready) await new Promise(r => setTimeout(r, 500));
    }
    if (!ready) throw new Error(`External MCP server not reachable at ${urlObj.href}`);

    const transport = new SSEClientTransport(new URL(urlObj.href + '/mcp'));
    this.client = new Client({ name: 'stdio-connector', version: '1.0.0' });
    await this.client.connect(transport);
    this.connected = true;
  }

  async cleanup(): Promise<void> {
    await super.cleanup();
    if (this.child) this.child.kill();
    this.child = null;
  }
}
