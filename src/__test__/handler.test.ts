import { createServer } from 'node:http';

import { describe, expect, test } from 'vitest';

import handler, { httpServer } from '../handler';
import type { AddressInfo } from 'node:net';

describe('vercel handler', () => {
  test('default export is a request listener, not a listening server', () => {
    expect(typeof handler).toBe('function');
    expect(httpServer.listening).toBe(false);
  });

  test('GET /health through the Node launcher shape', async () => {
    const server = createServer(handler);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const addr = server.address();
    if (addr === null || typeof addr === 'string') {
      throw new Error('expected TCP address');
    }
    const origin = `http://127.0.0.1:${(addr satisfies AddressInfo).port}`;
    const res = await fetch(`${origin}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });
});
