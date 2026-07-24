import cors from 'cors';
import compression from 'compression';
import express from 'express';
import { createServer } from 'node:http';
import { loginHandler, meHandler, registerHandler, authMiddleware } from './auth/auth.js';
import { config } from './config.js';
import { createRealtime } from './realtime/gateway.js';
import { apiRouter } from './api-routes.js';
import { platformRouter } from './platform-routes.js';
import { v2Router } from './v2-routes.js';
import { v25Router } from './v25-routes.js';
import { publicApiRouter } from './public-api/router.js';
import { pushRouter, liteAware } from './push/service.js';
import { bindNotificationIo } from './notifications/service.js';

async function main() {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(compression({ threshold: 512 }));
  app.use(express.json({ limit: '1mb' }));
  app.use(liteAware);

  app.post('/auth/register', registerHandler);
  app.post('/auth/login', loginHandler);
  app.get('/auth/me', authMiddleware, meHandler);
  app.use('/api', apiRouter);
  app.use('/api', platformRouter);
  app.use('/api', v2Router);
  app.use('/api', v25Router);
  app.use('/api', pushRouter);

  app.get('/public/openapi.json', async (_req, res) => {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    try {
      const candidates = [
        join(process.cwd(), 'docs/openapi-public.json'),
        join(process.cwd(), '../../docs/openapi-public.json'),
        join(process.cwd(), 'apps/api/docs/openapi-public.json'),
      ];
      let raw = '';
      for (const c of candidates) {
        try {
          raw = await readFile(c, 'utf8');
          break;
        } catch {
          /* try next */
        }
      }
      if (!raw) throw new Error('missing');
      res.type('json').send(raw);
    } catch {
      res.status(404).json({ error: 'OPENAPI_NOT_FOUND' });
    }
  });

  app.use('/public', publicApiRouter);

  const httpServer = createServer(app);
  const io = createRealtime(httpServer);
  bindNotificationIo(io);
  app.set('io', io);

  httpServer.listen(config.port, () => {
    console.log(`NexPlay API listening on :${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
