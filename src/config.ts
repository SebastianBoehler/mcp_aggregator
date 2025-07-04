import { readFileSync } from 'fs';

export function loadConfigFile(filepath: string): Record<string, any> {
  const text = readFileSync(filepath, 'utf8');
  return JSON.parse(text);
}

import { HttpConnector } from './connectors/http';
import { StdioConnector } from './connectors/stdio';

export function createConnectorFromConfig(serverConfig: Record<string, any>): StdioConnector | HttpConnector {
  if ('command' in serverConfig && 'args' in serverConfig) {
    return new StdioConnector({
      command: serverConfig.command,
      args: serverConfig.args,
      env: serverConfig.env,
      url: serverConfig.url,
    });
  }
  if ('url' in serverConfig) {
    return new HttpConnector(serverConfig.url, { headers: serverConfig.headers, authToken: serverConfig.auth_token });
  }
  throw new Error('Cannot determine connector type from config');
}
