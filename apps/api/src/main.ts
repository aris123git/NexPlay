import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { loginHandler, meHandler, registerHandler, authMiddleware } from './auth/auth.js';
import { config } from './config.js';
import { createRealtime } from './realtime/gateway.js';
import { apiRouter } from './api-routes.js';

async function main() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.post('/auth/register', registerHandler);
  app.post('/auth/login', loginHandler);
  app.get('/auth/me', authMiddleware, meHandler);
  app.use('/api', apiRouter);

  const httpServer = createServer(app);
  const io = createRealtime(httpServer);
  app.set('io', io);

  httpServer.listen(config.port, () => {
    console.log(`NexPlay API listening on :${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
