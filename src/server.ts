import { createServer } from 'node:http';

import express from 'express';
import { jwtVerify } from 'jose';
import { Server } from 'socket.io';

import { parseBroadcast, parseSocketClaims, readAuthToken } from './parse';
import type {
  RealtimeConfig,
  SocketAuth,
  TournamentInvalidateEvent,
} from './parse';

type ClientEvents = Record<string, never>;
type ServerEvents = {
  invalidate: (event: TournamentInvalidateEvent) => void;
};
type InterServerEvents = Record<string, never>;

type SocketData = {
  auth: SocketAuth;
};

type RealtimeIo = Server<
  ClientEvents,
  ServerEvents,
  InterServerEvents,
  SocketData
>;

export function createRealtimeServer(config: RealtimeConfig) {
  const app = express();
  app.use(express.json({ limit: '32kb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  const httpServer = createServer(app);
  const io: RealtimeIo = new Server(httpServer, {
    cors: {
      origin: config.corsOrigins,
      credentials: true,
    },
  });

  app.post('/internal/broadcast', (req, res) => {
    const auth = req.headers.authorization ?? '';
    const expected = `Bearer ${config.broadcastSecret}`;
    if (!config.broadcastSecret || auth !== expected) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const body: unknown = req.body;
    const parsed = parseBroadcast(body);
    switch (parsed.kind) {
      case 'error':
        res.status(400).json({ error: parsed.error });
        return;
      case 'ok': {
        const room = `tournament:${parsed.tournamentId}`;
        io.to(room).emit('invalidate', parsed.event);
        io.to('arena').emit('invalidate', parsed.event);
        res.json({ ok: true, room, arena: true });
        return;
      }
      default: {
        const _exhaustive: never = parsed;
        void _exhaustive;
      }
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = readAuthToken(socket.handshake.auth);
      if (!token) {
        next(new Error('missing_token'));
        return;
      }

      const { payload } = await jwtVerify(token, config.jwtSecret, {
        algorithms: ['HS256'],
      });
      const claims = parseSocketClaims(payload);
      if (!claims) {
        next(new Error('invalid_claims'));
        return;
      }

      socket.data.auth = claims;
      next();
    } catch {
      next(new Error('invalid_token'));
    }
  });

  io.on('connection', (socket) => {
    const claims = socket.data.auth;
    switch (claims.kind) {
      case 'arena':
        void socket.join('arena');
        return;
      case 'tournament': {
        const room = `tournament:${claims.tournamentId}`;
        void socket.join(room);
        const event = {
          type: 'invalidate',
          tournamentId: claims.tournamentId,
        } satisfies TournamentInvalidateEvent;
        socket.emit('invalidate', event);
        return;
      }
      default: {
        const _exhaustive: never = claims;
        void _exhaustive;
      }
    }
  });

  return { httpServer, io };
}

export type RealtimeServer = ReturnType<typeof createRealtimeServer>;
