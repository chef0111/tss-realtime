import { loadConfig } from './parse';
import { createRealtimeServer } from './create-server';

export const { app, httpServer } = createRealtimeServer(
  loadConfig(process.env)
);

export default app;
