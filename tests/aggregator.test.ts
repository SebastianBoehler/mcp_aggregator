import { expect, test } from 'bun:test';
import handler, { ready } from '../src/index';

const fetchHandler: typeof handler.fetch = (handler as any).fetch;

await ready;

function json(req: RequestInit & { url: string }) {
  return new Request(req.url, {
    ...req,
    headers: {
      'content-type': 'application/json',
      ...(req.headers || {}),
    },
    body: req.body ? req.body : req.method === 'POST' ? '{}' : undefined,
  });
}

test('discovery lists echo plugin', async () => {
  const res = await fetchHandler(new Request('http://test.local/mcp'));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toContain('echo');
});

test('echo plugin returns echoed msg', async () => {
  const payload = JSON.stringify({ msg: 'hello' });
  const req = json({
    url: 'http://test.local/mcp/echo/call',
    method: 'POST',
    body: payload,
  });
  const res = await fetchHandler(req);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toEqual({ echo: 'hello' });
});
