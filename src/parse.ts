import type { JWTPayload } from 'jose';

export type SocketAuth =
  | { kind: 'tournament'; userId: string; tournamentId: string }
  | { kind: 'arena'; userId: string };

export type TournamentInvalidateEvent = {
  type: 'invalidate';
  tournamentId: string;
};

export type BroadcastOk = {
  kind: 'ok';
  tournamentId: string;
  event: TournamentInvalidateEvent;
};

export type BroadcastError = {
  kind: 'error';
  error: 'tournamentId required' | 'event required';
};

export type BroadcastParse = BroadcastOk | BroadcastError;

export type RealtimeConfig = {
  port: number;
  corsOrigins: Array<string>;
  broadcastSecret: string;
  jwtSecret: Uint8Array;
};

const DEFAULT_PORT = 3331;
const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';

export function loadConfig(
  env: Record<string, string | undefined>
): RealtimeConfig {
  const jwtSecretRaw = env.TOURNAMENT_SOCKET_JWT_SECRET ?? '';
  const broadcastSecret = env.INTERNAL_BROADCAST_SECRET ?? '';

  if (!broadcastSecret || !jwtSecretRaw) {
    console.warn(
      '[realtime] Set INTERNAL_BROADCAST_SECRET and TOURNAMENT_SOCKET_JWT_SECRET in production.'
    );
  }

  return {
    port: parsePort(env.PORT),
    corsOrigins: parseCorsOrigins(env.CORS_ORIGINS),
    broadcastSecret,
    jwtSecret: new TextEncoder().encode(jwtSecretRaw),
  };
}

export function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw === '') {
    return DEFAULT_PORT;
  }

  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${raw}`);
  }

  return port;
}

export function parseCorsOrigins(raw: string | undefined): Array<string> {
  const origins = (raw ?? DEFAULT_CORS_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return origins.length > 0 ? origins : [DEFAULT_CORS_ORIGIN];
}

export function readAuthToken(auth: unknown): string | null {
  if (typeof auth !== 'object' || auth === null || !('token' in auth)) {
    return null;
  }

  const token = auth.token;
  if (typeof token !== 'string' || token.length === 0) {
    return null;
  }

  return token;
}

export function parseSocketClaims(payload: JWTPayload): SocketAuth | null {
  const userId = payload.sub;
  if (typeof userId !== 'string' || userId.length === 0) {
    return null;
  }

  if (payload.cat === 'arena') {
    return { kind: 'arena', userId };
  }

  const tournamentId = payload.tid;
  if (typeof tournamentId === 'string' && tournamentId.length > 0) {
    return { kind: 'tournament', userId, tournamentId };
  }

  return null;
}

export function parseBroadcast(body: unknown): BroadcastParse {
  if (typeof body !== 'object' || body === null || !('tournamentId' in body)) {
    return { kind: 'error', error: 'tournamentId required' };
  }

  const tournamentId = body.tournamentId;
  if (typeof tournamentId !== 'string' || tournamentId.length === 0) {
    return { kind: 'error', error: 'tournamentId required' };
  }

  if (!('event' in body)) {
    return { kind: 'error', error: 'event required' };
  }

  const event = parseInvalidateEvent(body.event);
  if (!event) {
    return { kind: 'error', error: 'event required' };
  }

  return { kind: 'ok', tournamentId, event };
}

function parseInvalidateEvent(
  value: unknown
): TournamentInvalidateEvent | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  if (!('type' in value) || !('tournamentId' in value)) {
    return null;
  }
  if (value.type !== 'invalidate') {
    return null;
  }
  if (
    typeof value.tournamentId !== 'string' ||
    value.tournamentId.length === 0
  ) {
    return null;
  }

  return { type: 'invalidate', tournamentId: value.tournamentId };
}
