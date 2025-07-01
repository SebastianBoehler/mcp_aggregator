import type { McpPlugin } from "../src/types";
import type { Hono } from "hono";

const PORT = Number(process.env.GWORKSPACE_PORT ?? 4010);
const CMD = [process.env.GWORKSPACE_CMD ?? "workspace-mcp", "--port", String(PORT)];

/**
 * Spawns the google_workspace_mcp server as a subprocess and proxies all
 * requests under /mcp/gworkspace to it.
 *
 * User must provide GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.
 */

// start subprocess once at module import
const child = Bun.spawn(CMD, {
  stdout: "pipe",
  stderr: "inherit",
  env: process.env as Record<string, string>,
});

// basic readiness check
await waitUntilReady();

async function waitUntilReady() {
  const base = `http://localhost:${PORT}`;
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${base}/openapi.json`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error("[gworkspace] Failed to start in time");
}

// ensure child properly exits when aggregator stops
process.on("SIGINT", () => child.kill());
process.on("SIGTERM", () => child.kill());

async function getOpenApi() {
  try {
    const res = await fetch(`http://localhost:${PORT}/openapi.json`);
    return await res.json();
  } catch (err) {
    console.warn("Could not fetch google_workspace_mcp spec", err);
    return { openapi: "3.0.1", info: { title: "Google Workspace MCP", version: "0.1.0" }, paths: {} };
  }
}

const plugin: McpPlugin = {
  name: "gworkspace",
  openapi: getOpenApi(),
  register(app: Hono) {
    app.all("*", async (c) => {
      const targetUrl = `http://localhost:${PORT}${c.req.path}`;
      const init: RequestInit = {
        method: c.req.method,
        headers: [...c.req.raw.headers.entries()].reduce<Record<string, string>>((acc, [k, v]) => {
          acc[k] = v;
          return acc;
        }, {}),
        body: ["GET", "HEAD"].includes(c.req.method) ? undefined : await c.req.raw.arrayBuffer(),
      };
      const resp = await fetch(targetUrl, init);
      return new Response(resp.body, { status: resp.status, headers: resp.headers });
    });
  },
};

export default plugin;
