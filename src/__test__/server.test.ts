import { SignJWT } from 'jose';
import { io as ioc } from 'socket.io-client';
import { afterEach, describe, expect, test } from 'vitest';

import { createRealtimeServer } from '../create-server';
import type { RealtimeServer } from '../create-server';
import type { AddressInfo } from 'node:net';
import type { RealtimeConfig, TournamentInvalidateEvent } from '../parse';

const JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars';
const BROADCAST_SECRET = 'test-broadcast-secret';

function testConfig(): RealtimeConfig {
  return {
    port: 0,
    corsOrigins: ['http://localhost:3000'],
    broadcastSecret: BROADCAST_SECRET,
    jwtSecret: new TextEncoder().encode(JWT_SECRET),
  };
}

function listeningPort(server: RealtimeServer['httpServer']): number {
  const addr = server.address();
  if (addr === null || typeof addr === 'string') {
    throw new Error('expected TCP address');
  }
  return (addr satisfies AddressInfo).port;
}

async function listen(server: RealtimeServer) {
  await new Promise<void>((resolve) => {
    server.httpServer.listen(0, '127.0.0.1', resolve);
  });
  return `http://127.0.0.1:${listeningPort(server.httpServer)}`;
}

async function signToken(claims: { tid: string } | { cat: 'arena' }) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .setSubject('user-1')
    .sign(new TextEncoder().encode(JWT_SECRET));
}

function waitForInvalidate(socket: ReturnType<typeof ioc>, label: string) {
  return new Promise<TournamentInvalidateEvent>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out waiting for ${label}`)),
      3000
    );
    socket.once('invalidate', (event) => {
      clearTimeout(timer);
      resolve(event);
    });
    socket.once('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

describe('realtime http', () => {
  let server: RealtimeServer | undefined;

  afterEach(async () => {
    if (!server) {
      return;
    }
    const closing = server;
    server = undefined;
    closing.io.close();
    await new Promise<void>((resolve, reject) => {
      closing.httpServer.close((err) => (err ? reject(err) : resolve()));
    });
  });

  test('GET /', async () => {
    server = createRealtimeServer(testConfig());
    const origin = await listen(server);
    const res = await fetch(`${origin}/`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Kyorbit real-time service' });
  });

  test('GET /health', async () => {
    server = createRealtimeServer(testConfig());
    const origin = await listen(server);
    const res = await fetch(`${origin}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test('POST /internal/broadcast rejects a missing bearer', async () => {
    server = createRealtimeServer(testConfig());
    const origin = await listen(server);
    const res = await fetch(`${origin}/internal/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tournamentId: 't-1',
        event: { type: 'invalidate', tournamentId: 't-1' },
      }),
    });
    expect(res.status).toBe(401);
  });

  test('POST /internal/broadcast validates the body', async () => {
    server = createRealtimeServer(testConfig());
    const origin = await listen(server);
    const res = await fetch(`${origin}/internal/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${BROADCAST_SECRET}`,
      },
      body: JSON.stringify({ tournamentId: 't-1' }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'event required' });
  });

  test('broadcast reaches a tournament socket', async () => {
    server = createRealtimeServer(testConfig());
    const origin = await listen(server);
    const token = await signToken({ tid: 't-1' });

    const socket = ioc(origin, {
      auth: { token },
      transports: ['polling'],
      autoConnect: false,
    });

    const connected = waitForInvalidate(socket, 'connect invalidate');
    socket.connect();
    expect(await connected).toEqual({
      type: 'invalidate',
      tournamentId: 't-1',
    });

    const nextEvent = waitForInvalidate(socket, 'broadcast');
    const res = await fetch(`${origin}/internal/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${BROADCAST_SECRET}`,
      },
      body: JSON.stringify({
        tournamentId: 't-1',
        event: { type: 'invalidate', tournamentId: 't-1' },
      }),
    });
    expect(res.status).toBe(200);
    expect(await nextEvent).toEqual({
      type: 'invalidate',
      tournamentId: 't-1',
    });

    socket.disconnect();
  });
});
