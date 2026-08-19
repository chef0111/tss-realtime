import { describe, expect, test } from 'vitest';

import {
  parseBroadcast,
  parseCorsOrigins,
  parsePort,
  parseSocketClaims,
  readAuthToken,
} from '../parse';
import type { JWTPayload } from 'jose';

describe('parsePort', () => {
  test('defaults when unset', () => {
    expect(parsePort(undefined)).toBe(3331);
    expect(parsePort('')).toBe(3331);
  });

  test('accepts a valid port', () => {
    expect(parsePort('8080')).toBe(8080);
  });

  test('rejects out of range', () => {
    expect(() => parsePort('0')).toThrow('Invalid PORT');
    expect(() => parsePort('65536')).toThrow('Invalid PORT');
    expect(() => parsePort('nope')).toThrow('Invalid PORT');
  });
});

describe('parseCorsOrigins', () => {
  test('splits and trims', () => {
    expect(parseCorsOrigins('https://a.test, http://b.test ')).toEqual([
      'https://a.test',
      'http://b.test',
    ]);
  });

  test('defaults when empty', () => {
    expect(parseCorsOrigins(undefined)).toEqual(['http://localhost:3000']);
    expect(parseCorsOrigins(' , ')).toEqual(['http://localhost:3000']);
  });
});

describe('readAuthToken', () => {
  test('reads a non-empty token', () => {
    expect(readAuthToken({ token: 'abc' })).toBe('abc');
  });

  test('rejects missing or empty token', () => {
    expect(readAuthToken(undefined)).toBeNull();
    expect(readAuthToken({})).toBeNull();
    expect(readAuthToken({ token: '' })).toBeNull();
    expect(readAuthToken({ token: 1 })).toBeNull();
  });
});

describe('parseSocketClaims', () => {
  test('parses an arena catalog token', () => {
    const payload: JWTPayload = { sub: 'user-1', cat: 'arena' };
    expect(parseSocketClaims(payload)).toEqual({
      kind: 'arena',
      userId: 'user-1',
    });
  });

  test('parses a tournament token', () => {
    const payload: JWTPayload = { sub: 'user-1', tid: 't-1' };
    expect(parseSocketClaims(payload)).toEqual({
      kind: 'tournament',
      userId: 'user-1',
      tournamentId: 't-1',
    });
  });

  test('prefers arena when both claims are present', () => {
    const payload: JWTPayload = { sub: 'user-1', tid: 't-1', cat: 'arena' };
    expect(parseSocketClaims(payload)).toEqual({
      kind: 'arena',
      userId: 'user-1',
    });
  });

  test('rejects missing sub or claims', () => {
    expect(parseSocketClaims({ tid: 't-1' })).toBeNull();
    expect(parseSocketClaims({ sub: '', tid: 't-1' })).toBeNull();
    expect(parseSocketClaims({ sub: 'user-1' })).toBeNull();
    expect(parseSocketClaims({ sub: 'user-1', cat: 'other' })).toBeNull();
  });
});

describe('parseBroadcast', () => {
  test('accepts an invalidate payload', () => {
    expect(
      parseBroadcast({
        tournamentId: 't-1',
        event: { type: 'invalidate', tournamentId: 't-1' },
      })
    ).toEqual({
      kind: 'ok',
      tournamentId: 't-1',
      event: { type: 'invalidate', tournamentId: 't-1' },
    });
  });

  test('rejects a missing tournamentId', () => {
    expect(
      parseBroadcast({ event: { type: 'invalidate', tournamentId: 't-1' } })
    ).toEqual({ kind: 'error', error: 'tournamentId required' });
  });

  test('rejects a missing or invalid event', () => {
    expect(parseBroadcast({ tournamentId: 't-1' })).toEqual({
      kind: 'error',
      error: 'event required',
    });
    expect(
      parseBroadcast({ tournamentId: 't-1', event: { type: 'other' } })
    ).toEqual({
      kind: 'error',
      error: 'event required',
    });
  });
});
