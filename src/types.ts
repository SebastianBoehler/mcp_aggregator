export interface McpPlugin {
  /** A unique identifier (no slashes) */
  name: string;
  /** OpenAPI spec JSON object OR async loader conforming to MCP server schema */
  openapi: Record<string, any> | (() => Promise<Record<string, any>>);
  /** Initialize routes on the provided Hono app under `/mcp/<name>` */
  register(app: import('hono').Hono): void;
}
