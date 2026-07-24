import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from './auth/auth.js';
import { localeCatalog, resolveContinent } from './i18n/catalog.js';
import * as rankings from './rankings/service.js';
import * as shop from './shop/service.js';
import * as events from './events/service.js';
import * as apiKeys from './public-api/keys.js';
import { prisma } from './db.js';
import { getActiveSeason } from './seasons/service.js';

export const v25Router = Router();

// —— Localization catalog ——
v25Router.get('/i18n/catalog', (_req, res) => {
  res.json(localeCatalog());
});

v25Router.patch('/i18n/preferences', authMiddleware, async (req, res) => {
  const schema = z.object({
    locale: z.enum(['fr', 'en', 'ar', 'pt', 'es']).optional(),
    currency: z.string().length(3).optional(),
    timezone: z.string().min(3).max(64).optional(),
    countryCode: z.string().length(2).optional(),
    regionName: z.string().max(80).optional().nullable(),
    cityName: z.string().max(80).optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'VALIDATION' });

  const data = parsed.data;
  const countryCode = data.countryCode?.toUpperCase();
  const profile = await prisma.playerProfile.update({
    where: { userId: req.user!.id },
    data: {
      ...(data.locale ? { locale: data.locale } : {}),
      ...(data.currency ? { currency: data.currency.toUpperCase() } : {}),
      ...(data.timezone ? { timezone: data.timezone } : {}),
      ...(countryCode
        ? { countryCode, continentCode: resolveContinent(countryCode) }
        : {}),
      ...(data.regionName !== undefined ? { regionName: data.regionName } : {}),
      ...(data.cityName !== undefined ? { cityName: data.cityName } : {}),
    },
  });
  res.json({ profile });
});

// —— Rankings ——
v25Router.get('/rankings/meta', (_req, res) => {
  res.json(rankings.rankingMeta());
});

async function gameRankingsHandler(req: Request, res: Response) {
  const scope = (req.query.scope as rankings.RankScope) || 'world';
  const entries = await rankings.gameLeaderboard({
    gameId: req.params.gameId,
    scope,
    continentCode: typeof req.query.continent === 'string' ? req.query.continent : undefined,
    countryCode: typeof req.query.country === 'string' ? req.query.country : undefined,
    regionName: typeof req.query.region === 'string' ? req.query.region : undefined,
  });
  res.json({ scope, gameId: req.params.gameId, entries });
}

v25Router.get('/rankings/game/:gameId', gameRankingsHandler);
v25Router.get('/rankings/games/:gameId', gameRankingsHandler);

// `/active` must be registered before `/:seasonId`
v25Router.get('/rankings/season/active', async (req, res) => {
  const active = await getActiveSeason();
  if (!active) return res.json({ season: null, entries: [] });
  const scope = (req.query.scope as rankings.RankScope) || 'world';
  const entries = await rankings.seasonLeaderboardScoped({
    seasonId: active.id,
    scope,
    continentCode: typeof req.query.continent === 'string' ? req.query.continent : undefined,
    countryCode: typeof req.query.country === 'string' ? req.query.country : undefined,
  });
  res.json({ season: active, scope, entries });
});

v25Router.get('/rankings/season/:seasonId', async (req, res) => {
  const scope = (req.query.scope as rankings.RankScope) || 'world';
  const entries = await rankings.seasonLeaderboardScoped({
    seasonId: req.params.seasonId,
    gameId: typeof req.query.gameId === 'string' ? req.query.gameId : 'all',
    scope,
    continentCode: typeof req.query.continent === 'string' ? req.query.continent : undefined,
    countryCode: typeof req.query.country === 'string' ? req.query.country : undefined,
  });
  res.json({ scope, seasonId: req.params.seasonId, entries });
});

v25Router.get('/rankings/clans', async (req, res) => {
  const scope = (req.query.scope as rankings.RankScope) || 'world';
  const entries = await rankings.clanLeaderboard({
    scope,
    continentCode: typeof req.query.continent === 'string' ? req.query.continent : undefined,
    countryCode: typeof req.query.country === 'string' ? req.query.country : undefined,
  });
  res.json({ scope, entries });
});

// —— Shop ——
v25Router.get('/shop', async (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  res.json({ items: await shop.listShop(category) });
});

v25Router.get('/shop/inventory', authMiddleware, async (req, res) => {
  res.json(await shop.getInventory(req.user!.id));
});

v25Router.post('/shop/purchase', authMiddleware, async (req, res) => {
  try {
    const sku = String(req.body?.sku ?? '');
    const result = await shop.purchaseItem(req.user!.id, sku);
    res.status(201).json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

v25Router.post('/shop/equip', authMiddleware, async (req, res) => {
  try {
    res.json(await shop.equipItem(req.user!.id, String(req.body?.sku ?? '')));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

v25Router.post('/shop/unequip', authMiddleware, async (req, res) => {
  try {
    res.json(await shop.unequipSlot(req.user!.id, String(req.body?.category ?? '')));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// —— Events / Challenges ——
v25Router.get('/events/challenges', authMiddleware, async (req, res) => {
  res.json({ challenges: await events.listActiveChallenges(req.user!.id) });
});

v25Router.post('/events/challenges/:id/claim', authMiddleware, async (req, res) => {
  try {
    res.json(await events.claimChallenge(req.user!.id, req.params.id));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// —— Developer API keys (authenticated user) ——
v25Router.get('/developer/keys', authMiddleware, async (req, res) => {
  res.json({ keys: await apiKeys.listApiKeys(req.user!.id) });
});

v25Router.post('/developer/keys', authMiddleware, async (req, res) => {
  const name = String(req.body?.name ?? 'Default').slice(0, 60);
  const scopes = Array.isArray(req.body?.scopes)
    ? (req.body.scopes as string[])
    : ['read:public'];
  const key = await apiKeys.createApiKey(req.user!.id, name, scopes);
  res.status(201).json(key);
});

v25Router.delete('/developer/keys/:id', authMiddleware, async (req, res) => {
  res.json(await apiKeys.revokeApiKey(req.user!.id, req.params.id));
});
