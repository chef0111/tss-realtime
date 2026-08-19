# TKU Sparring — tournament realtime (Socket.io)

Single-process Socket.io server: browsers subscribe per tournament room; the main app notifies this service over HTTPS after mutations.

## Environment

| Variable                       | Description                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `PORT`                         | Listen port (default `3331`)                                                                            |
| `CORS_ORIGINS`                 | Comma-separated allowed web origins (e.g. `https://your-app.vercel.app,http://localhost:3000`)          |
| `INTERNAL_BROADCAST_SECRET`    | Bearer secret for `POST /internal/broadcast` (must match main app `REALTIME_INTERNAL_BROADCAST_SECRET`) |
| `TOURNAMENT_SOCKET_JWT_SECRET` | Shared HS256 secret for socket JWT (must match main app)                                                |

## HTTP

- `GET /health` — liveness JSON `{ ok: true }`
- `POST /internal/broadcast` — body `{ "tournamentId": "<id>", "event": { "type": "invalidate", "tournamentId": "<id>" } }`, header `Authorization: Bearer <INTERNAL_BROADCAST_SECRET>`

## WebSocket

Clients connect with `socket.io-client` to this origin and pass `auth: { token }` where `token` is issued by the main app `GET /api/tournament/socket-token`.

Room per connection: `tournament:<tournamentId>` (derived from JWT `tid` claim).

## Local dev

TypeScript, run with Node via `tsx` (no `.js` import suffixes, no compile step).

```bash
bun install
bun run dev
bun run typecheck
bun run test
```

Point the main app at `http://localhost:3331` for server-side broadcast (`REALTIME_INTERNAL_BROADCAST_URL`) and `https://ws.tss.localhost` for the browser (`VITE_REALTIME_URL`) when using Portless. Node cannot resolve `*.localhost` on Windows.
