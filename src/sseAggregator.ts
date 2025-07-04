import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { MCPClient } from './client';

interface Options {
  config: string | Record<string, any>;
  port?: number;
}

export async function startSseAggregator(opts: Options): Promise<void> {
  const client = typeof opts.config === 'string' ? MCPClient.fromConfigFile(opts.config) : MCPClient.fromDict(opts.config);
  const sessions = await client.createAllSessions(true);
  const server = new McpServer({ name: 'aggregator', version: '1.0.0' });

  for (const [name, connector] of Object.entries(sessions)) {
    const tools = await connector.listTools();
    for (const tool of tools) {
      const toolName = `${name}/${tool.name}`;
      server.tool(toolName, tool.description ?? '', tool.inputSchema as any, async (args: any) => {
        const result = await connector.callTool(tool.name, args);
        return result;
      });
    }
  }

  const transports: Record<string, SSEServerTransport> = {};
  const app = express();
  app.use(express.json());

  app.get('/mcp', async (req: Request, res: Response) => {
    const transport = new SSEServerTransport('/messages', res);
    const sid = transport.sessionId;
    transports[sid] = transport;
    transport.onclose = () => { delete transports[sid]; };
    await server.connect(transport);
  });

  app.post('/messages', async (req: Request, res: Response) => {
    const sid = req.query.sessionId as string;
    const transport = transports[sid];
    if (!transport) {
      res.status(404).send('Session not found');
      return;
    }
    await transport.handlePostMessage(req as any, res as any, req.body);
  });

  const listenPort = opts.port ?? 3000;
  await new Promise<void>(resolve => {
    app.listen(listenPort, () => {
      console.log(`Aggregated MCP server listening on ${listenPort}`);
      resolve();
    });
  });
}
