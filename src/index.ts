import { loadLocalEnv } from './env';
import { loadConfig } from './parse';
import { createRealtimeServer } from './create-server';

loadLocalEnv();

const config = loadConfig(process.env);
const host = process.env.HOST ?? '0.0.0.0';
const { httpServer } = createRealtimeServer(config);

httpServer.on('error', (err) => {
  console.error(`[realtime] listen failed on ${host}:${config.port}`, err);
  process.exit(1);
});

httpServer.listen(config.port, host, () => {
  console.log(`[realtime] listening on ${host}:${config.port}`);
});
