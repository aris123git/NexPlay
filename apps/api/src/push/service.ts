import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../auth/auth.js';
import { prisma } from '../db.js';

export const pushRouter = Router();

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

pushRouter.get('/push/vapid-public', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({ publicKey: getVapidPublicKey() });
});

pushRouter.post('/push/subscribe', authMiddleware, async (req, res) => {
  const schema = z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
    platform: z.enum(['web', 'ios', 'android']).default('web'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'VALIDATION' });

  const { endpoint, keys, platform } = parsed.data;
  const row = await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: req.user!.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      platform,
    },
    update: {
      userId: req.user!.id,
      p256dh: keys.p256dh,
      auth: keys.auth,
      platform,
    },
  });
  res.status(201).json({ id: row.id, platform: row.platform });
});

pushRouter.delete('/push/subscribe', authMiddleware, async (req, res) => {
  const endpoint = String(req.body?.endpoint ?? '');
  if (!endpoint) return res.status(400).json({ error: 'ENDPOINT_REQUIRED' });
  await prisma.pushSubscription.deleteMany({
    where: { userId: req.user!.id, endpoint },
  });
  res.json({ ok: true });
});

/** Cache court pour catalogues publics */
export function shortPublicCache(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
  next();
}

/** Réduit les payloads si client Lite */
export function liteAware(req: Request, _res: Response, next: NextFunction) {
  (req as Request & { lite?: boolean }).lite = req.header('x-nexplay-lite') === '1';
  next();
}
