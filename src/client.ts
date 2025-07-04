import { createConnectorFromConfig, loadConfigFile } from './config';
import { BaseConnector } from './connectors/base';

export class MCPClient {
  private config: Record<string, any> = {};
  private sessions: Record<string, BaseConnector> = {};
  public activeSessions: string[] = [];

  constructor(config?: string | Record<string, any>) {
    if (config) {
      if (typeof config === 'string') {
        this.config = loadConfigFile(config);
      } else {
        this.config = config;
      }
    }
  }

  static fromDict(cfg: Record<string, any>): MCPClient {
    return new MCPClient(cfg);
  }

  static fromConfigFile(path: string): MCPClient {
    return new MCPClient(loadConfigFile(path));
  }

  addServer(name: string, serverConfig: Record<string, any>): void {
    this.config.mcpServers = this.config.mcpServers || {};
    this.config.mcpServers[name] = serverConfig;
  }

  async createSession(name: string, autoInit = true): Promise<BaseConnector> {
    const servers = this.config.mcpServers ?? {};
    if (!servers[name]) throw new Error(`Server '${name}' not found in config`);
    const connector = createConnectorFromConfig(servers[name]);
    await connector.connect();
    if (autoInit) await connector.initialize();
    this.sessions[name] = connector;
    if (!this.activeSessions.includes(name)) this.activeSessions.push(name);
    return connector;
  }

  async createAllSessions(autoInit = true): Promise<Record<string, BaseConnector>> {
    const servers = this.config.mcpServers ?? {};
    for (const name of Object.keys(servers)) {
      if (servers[name].disabled) continue;
      await this.createSession(name, autoInit);
    }
    return this.sessions;
  }

  getSession(name: string): BaseConnector | undefined {
    return this.sessions[name];
  }
}
