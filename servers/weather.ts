import type { McpPlugin } from '../src/types';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Hono } from 'hono';

// Build weather MCP server using SDK
const mcpServer = new McpServer({ name: 'weather', version: '0.1.0' });

const weatherInput = { city: z.string(), country: z.string().optional() };
const weatherOutput = {
  temperature: z.object({ celsius: z.number(), fahrenheit: z.number() }),
  conditions: z.enum(['sunny', 'cloudy', 'rainy', 'stormy', 'snowy']),
};

type WeatherArgs = { city: string; country?: string };

// Simple random weather generator
const weatherCallback = async ({ city }: WeatherArgs) => {
  void city;
  const tempC = Math.round((Math.random() * 35 - 5) * 10) / 10;
  const structuredContent = {
    temperature: { celsius: tempC, fahrenheit: Math.round((tempC * 9) / 5 + 32) },
    conditions: ['sunny', 'cloudy', 'rainy', 'stormy', 'snowy'][Math.floor(Math.random() * 5)] as 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy',
  };
  return { structuredContent };
};

mcpServer.registerTool('get_weather', {
  title: 'Get Weather',
  description: 'Returns fake weather for a city',
  inputSchema: weatherInput,
  outputSchema: weatherOutput,
}, weatherCallback);

// Build simple OpenAPI spec (minimal)
const openapiSpec = {
  openapi: '3.0.1',
  info: { title: 'Weather MCP', version: '0.1.0' },
  paths: {
    '/get_weather': {
      post: {
        operationId: 'getWeather',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { city: { type: 'string' }, country: { type: 'string' } }, required: ['city'] },
            },
          },
        },
        responses: {
          '200': {
            description: 'Weather response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    temperature: { type: 'object', properties: { celsius: { type: 'number' }, fahrenheit: { type: 'number' } } },
                    conditions: { type: 'string' },
                  },
                  required: ['temperature', 'conditions'],
                },
              },
            },
          },
        },
      },
    },
  },
};

const weatherPlugin: McpPlugin = {
  name: 'weather',
  openapi: openapiSpec,
  register(app: Hono) {
    app.post('/get_weather', async (c) => {
      const body = await c.req.json<WeatherArgs>();
      const result = await weatherCallback(body);
      return c.json(result.structuredContent);
    });
  },
};

export default weatherPlugin;
