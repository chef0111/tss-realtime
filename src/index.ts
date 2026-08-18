import { loadConfig } from './parse';
import { createRealtimeServer } from './server';

const config = loadConfig(process.env);
const { httpServer } = createRealtimeServer(config);
httpServer.listen(config.port, () => {
  console.log(`[realtime] listening on :${config.port}`);
});
