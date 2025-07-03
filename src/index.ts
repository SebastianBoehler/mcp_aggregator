import { Hono } from 'hono';
import { McpPlugin } from './types';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';

// Create main app
const app = new Hono();

// Dynamically load all plugins inside ./servers folder and from external config file
interface LoadedSpec { name: string; spec: Record<string, any>; }
interface ExternalServerDef {
  /** If provided the aggregator will spawn the command. If omitted, we treat this entry as an already-running hosted server */
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  /** Base URL where the server listens (required for hosted servers, optional for local) */
  url: string;
}

async function registerHosted(name: string, def: ExternalServerDef): Promise<LoadedSpec | null> {
  const baseUrl = def.url;
  if (!baseUrl) {
    console.warn(`Hosted MCP server ${name} missing url property`);
    return null;
  }
  try {
    const res = await fetch(`${baseUrl}/openapi.json`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const spec = await res.json();
    // proxy
    app.all(`/mcp/${name}/*`, async (c) => {
      const targetPath = c.req.path.replace(`/mcp/${name}`, '');
      const search = new URL(c.req.url).search;
      const targetUrl = `${baseUrl}${targetPath}${search}`;
      const resProxy = await fetch(targetUrl, {
        method: c.req.method,
        headers: c.req.raw.headers,
        body: ['GET', 'HEAD'].includes(c.req.method) ? undefined : c.req.raw.body,
      });
      return new Response(resProxy.body, { status: resProxy.status, headers: resProxy.headers });
    });
    console.log(`Registered hosted MCP server ${name} at ${baseUrl}`);
    return { name, spec };
  } catch (err) {
    console.warn(`Hosted MCP server ${name} not reachable at ${baseUrl}:`, err);
    return null;
  }
}

async function spawnExternal(name: string, def: ExternalServerDef, defaultPort: number): Promise<LoadedSpec | null> {
  if (!def.command) {
    // Treat as hosted if command absent
    return registerHosted(name, def);
  }
  const baseUrl = def.url || `http://127.0.0.1:${defaultPort}`;
  const urlPort = Number(new URL(baseUrl).port);
  const child = Bun.spawn([
    def.command,
    ...(def.args ?? []),
  ], {
    env: {
      ...process.env,
      ...(def.env ?? {}),
      PORT: String(urlPort),
    },
    stdout: 'inherit',
    stderr: 'inherit',
  });

  // Wait until /openapi.json is reachable (max 10s)
  const deadline = Date.now() + 10_000;
  let ready = false;
  while (!ready && Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/openapi.json`, { method: 'GET' });
      if (res.ok) {
        ready = true;
        const spec = await res.json();
        // proxy all traffic
        app.all(`/mcp/${name}/*`, async (c) => {
          const targetPath = c.req.path.replace(`/mcp/${name}`, '');
          const search = new URL(c.req.url).search;
          const targetUrl = `${baseUrl}${targetPath}${search}`;
          const resProxy = await fetch(targetUrl, {
            method: c.req.method,
            headers: c.req.raw.headers,
            body: ['GET', 'HEAD'].includes(c.req.method) ? undefined : c.req.raw.body,
          });
          return new Response(resProxy.body, { status: resProxy.status, headers: resProxy.headers });
        });
        console.log(`Started external MCP server ${name} on ${baseUrl}`);
        return { name, spec };
      }
    } catch (_) {
      // retry
    }
    await new Promise(r => setTimeout(r, 500));
  }
  console.warn(`External MCP server ${name} not reachable at ${baseUrl}`);
  child.kill();
  return null;
}

async function loadPlugins(): Promise<LoadedSpec[]> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const serversDir = join(__dirname, '..', 'servers');
  let specs: LoadedSpec[] = [];
  try {
    const files = await readdir(serversDir);
    for (const file of files) {
      if (!file.match(/\.(js|ts|mjs)$/)) continue;
      const mod: { default: McpPlugin } = await import(join(serversDir, file));
      const plugin = mod.default;
      if (!plugin) {
        console.warn(`Skipping ${file} – no default export.`);
        continue;
      }
      if (typeof plugin.register !== 'function') {
        console.warn(`Skipping ${file} – register() missing.`);
        continue;
      }
      // Register under /mcp/<name>
      const subApp = new Hono();
      plugin.register(subApp);
      app.route(`/mcp/${plugin.name}`, subApp);
      const spec = typeof (plugin.openapi as any)?.then === 'function' ? await plugin.openapi : plugin.openapi;
      specs.push({ name: plugin.name, spec });
      console.log(`Loaded MCP plugin: ${plugin.name}`);
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') console.error(err);
    else console.warn('No servers/ directory found – starting with no plugins.');
  }
  /* load external servers from mcp_servers.json */
  const cfgPath = join(__dirname, '..', 'mcp_servers.json');
  try {
    const text = await Bun.file(cfgPath).text();
    const cfg = JSON.parse(text);
    const servers: Record<string, ExternalServerDef> = cfg.mcpServers ?? {};
    let portSeed = 9100;
    for (const [name, def] of Object.entries(servers)) {
      const loaded = await spawnExternal(name, def, portSeed++);
      if (loaded) specs.push(loaded);
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') console.error('Failed loading external servers:', err);
  }

  return specs;
}

// prepare combined spec
let combinedSpec: Record<string, any> | null = null;
let cachedPlugins: LoadedSpec[] = [];

// On startup, eagerly load all plugins once and expose readiness promise
export const ready: Promise<void> = (async () => {
  cachedPlugins = await loadPlugins();
})();

// Discovery route: list available plugin names
app.get('/mcp', (c) => {
  return c.json(cachedPlugins.map(p => p.name));
});

app.get('/openapi.json', async (c) => {
  if (!combinedSpec) {
    const loaded = cachedPlugins;
    combinedSpec = {
      openapi: '3.0.1',
      info: { title: 'MCP Aggregator', version: '0.1.0' },
      paths: {},
    };
    for (const { name, spec } of loaded) {
      for (const [path, def] of Object.entries(spec.paths)) {
        combinedSpec.paths[`/mcp/${name}${path}`] = def;
      }
    }
  }
  return c.json(combinedSpec);
});

export default {
  fetch: app.fetch,
};
