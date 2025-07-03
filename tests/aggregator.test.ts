import { expect, test } from "bun:test";
import handler, { ready } from "../src/index";

const fetchHandler: typeof handler.fetch = (handler as any).fetch;

await ready;

test("discovery lists echo plugin", async () => {
  const res = await fetchHandler(new Request("http://test.local/mcp"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toContain("echo");
});
