import { expect, test } from 'bun:test';
import { createConnectorFromConfig, loadConfigFile } from '../src/config';
import { StdioConnector } from '../src/connectors/stdio';
import { HttpConnector } from '../src/connectors/http';
import { MCPClient } from '../src/client';

const sampleConfig = {
  mcpServers: {
    local: { command: 'node', args: ['server.js'], url: 'http://127.0.0.1:9000', disabled: true },
    remote: { url: 'http://example.com', disabled: true }
  }
};

test('createConnectorFromConfig detects stdio', () => {
  const conn = createConnectorFromConfig(sampleConfig.mcpServers.local);
  expect(conn).toBeInstanceOf(StdioConnector);
});

test('createConnectorFromConfig detects http', () => {
  const conn = createConnectorFromConfig(sampleConfig.mcpServers.remote);
  expect(conn).toBeInstanceOf(HttpConnector);
});

test('MCPClient loads from dict', async () => {
  const client = MCPClient.fromDict(sampleConfig);
  const sessions = await client.createAllSessions();
  expect(Object.keys(sessions).length).toBe(0);
  expect(client.activeSessions.length).toBe(0);
});
