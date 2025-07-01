import { Hono } from 'hono';
import { McpPlugin } from './types';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';

// Create main app
const app = new Hono();

// Dynamically load all plugins inside ./servers folder
interface LoadedSpec { name: string; spec: Record<string, any>; }
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
      specs.push({ name: plugin.name, spec: plugin.openapi });
      console.log(`Loaded MCP plugin: ${plugin.name}`);
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') console.error(err);
    else console.warn('No servers/ directory found – starting with no plugins.');
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
