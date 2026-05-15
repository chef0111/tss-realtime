import { createServer } from 'node:http';
import express from 'express';
import { jwtVerify } from 'jose';
import { Server } from 'socket.io';

const PORT = Number(process.env.PORT ?? 3331);
const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const INTERNAL_BROADCAST_SECRET = process.env.INTERNAL_BROADCAST_SECRET ?? '';
const jwtSecretBytes = new TextEncoder().encode(
  process.env.TOURNAMENT_SOCKET_JWT_SECRET ?? ''
);

if (!INTERNAL_BROADCAST_SECRET || !process.env.TOURNAMENT_SOCKET_JWT_SECRET) {
  console.warn(
    '[realtime] Set INTERNAL_BROADCAST_SECRET and TOURNAMENT_SOCKET_JWT_SECRET in production.'
  );
}

const app = express();
app.use(express.json({ limit: '32kb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGINS,
    credentials: true,
  },
});

app.post('/internal/broadcast', (req, res) => {
  const auth = req.headers.authorization ?? '';
  const expected = `Bearer ${INTERNAL_BROADCAST_SECRET}`;
  if (!INTERNAL_BROADCAST_SECRET || auth !== expected) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const tournamentId = req.body?.tournamentId;
  const event = req.body?.event;
  if (typeof tournamentId !== 'string' || !tournamentId) {
    res.status(400).json({ error: 'tournamentId required' });
    return;
  }
  if (!event || typeof event !== 'object') {
    res.status(400).json({ error: 'event required' });
    return;
  }
  const room = `tournament:${tournamentId}`;
  io.to(room).emit('invalidate', event);
  res.json({ ok: true, room });
});

io.use(async (socket, next) => {
  try {
    const token =
      typeof socket.handshake.auth?.token === 'string'
        ? socket.handshake.auth.token
        : null;
    if (!token) {
      next(new Error('missing_token'));
      return;
    }
    const { payload } = await jwtVerify(token, jwtSecretBytes, {
      algorithms: ['HS256'],
    });
    const tournamentId = payload.tid;
    const sub = payload.sub;
    if (typeof tournamentId !== 'string' || !tournamentId) {
      next(new Error('invalid_tid'));
      return;
    }
    if (typeof sub !== 'string' || !sub) {
      next(new Error('invalid_sub'));
      return;
    }
    socket.data.tournamentId = tournamentId;
    socket.data.userId = sub;
    next();
  } catch {
    next(new Error('invalid_token'));
  }
});

io.on('connection', (socket) => {
  const tid = socket.data.tournamentId;
  const room = `tournament:${tid}`;
  void socket.join(room);
  socket.emit('invalidate', { type: 'invalidate', tournamentId: tid });
  socket.emit('invalidate', { type: 'invalidate', tournamentId: tid });
});

httpServer.listen(PORT, () => {
  console.log(`[realtime] listening on :${PORT}`);
});
