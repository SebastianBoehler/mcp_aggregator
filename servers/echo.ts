import type { McpPlugin } from '../src/types';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Build echo MCP server using official SDK
const mcpServer = new McpServer({ name: 'echo', version: '0.1.0' });

const echoShape = { msg: z.string() };

const echoCallback = async ({ msg }: { msg: string }) => ({ structuredContent: { echo: msg } });

mcpServer.registerTool(
  'echo',
  {
    title: 'Echo tool',
    description: 'Echo back a string',
    inputSchema: echoShape,
    outputSchema: { echo: z.string() },
  },
  echoCallback
);

const echoPlugin: McpPlugin = {
  name: 'echo',
  openapi: {
    openapi: '3.0.1',
    info: { title: 'Echo MCP', version: '0.1.0' },
    paths: {
      '/call': {
        post: {
          operationId: 'callEcho',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] } } },
          },
          responses: {
            '200': {
              description: 'Echo response',
              content: { 'application/json': { schema: { type: 'object', properties: { echo: { type: 'string' } }, required: ['echo'] } } },
            },
          },
        },
      },
    },
  },
  register(app) {
    // minimal endpoint to trigger echo via MCP tool internally
    app.post('/call', async (c) => {
      const body = await c.req.json<{msg:string}>();
      const result = await echoCallback(body);
      return c.json(result.structuredContent ?? {});
    });
  },
};

export default echoPlugin;
