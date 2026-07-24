import { Router } from 'express';
import { prisma } from '../db.js';
import { listInstalledGames } from '../games/register.js';
import * as rankings from '../rankings/service.js';
import { getActiveSeason, listSeasons } from '../seasons/service.js';
import { listShop } from '../shop/service.js';
import { localeCatalog } from '../i18n/catalog.js';
import { apiKeyMiddleware, requireScope } from './keys.js';
import { onlineCount } from '../presence/service.js';

/**
 * API publique documentée — header `X-Api-Key: nxp_…`
 * Scopes: read:public
 */
export const publicApiRouter = Router();

publicApiRouter.use(apiKeyMiddleware);

publicApiRouter.get('/v1/health', requireScope('read:public'), (_req, res) => {
  res.json({
    ok: true,
    service: 'nexplay-public-api',
    version: '1.0.0',
    onlineCount: onlineCount(),
  });
});

publicApiRouter.get('/v1/games', requireScope('read:public'), async (_req, res) => {
  const catalog = await prisma.gameDefinition.findMany({
    where: { isEnabled: true },
    orderBy: { name: 'asc' },
  });
  res.json({
    catalog,
    installed: listInstalledGames(),
  });
});

publicApiRouter.get('/v1/leaderboards/:gameId', requireScope('read:public'), async (req, res) => {
  const scope = (req.query.scope as rankings.RankScope) || 'world';
  const entries = await rankings.gameLeaderboard({
    gameId: req.params.gameId,
    scope,
    continentCode: typeof req.query.continent === 'string' ? req.query.continent : undefined,
    countryCode: typeof req.query.country === 'string' ? req.query.country : undefined,
  });
  res.json({ gameId: req.params.gameId, scope, entries });
});

publicApiRouter.get('/v1/seasons', requireScope('read:public'), async (_req, res) => {
  res.json({
    seasons: await listSeasons(),
    active: await getActiveSeason(),
  });
});

publicApiRouter.get('/v1/clans/leaderboard', requireScope('read:public'), async (req, res) => {
  const scope = (req.query.scope as rankings.RankScope) || 'world';
  res.json({
    scope,
    entries: await rankings.clanLeaderboard({
      scope,
      countryCode: typeof req.query.country === 'string' ? req.query.country : undefined,
      continentCode: typeof req.query.continent === 'string' ? req.query.continent : undefined,
    }),
  });
});

publicApiRouter.get('/v1/shop', requireScope('read:public'), async (_req, res) => {
  res.json({ items: await listShop() });
});

publicApiRouter.get('/v1/i18n', requireScope('read:public'), (_req, res) => {
  res.json(localeCatalog());
});

publicApiRouter.get('/v1/tournaments', requireScope('read:public'), async (_req, res) => {
  const list = await prisma.tournament.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: {
      id: true,
      name: true,
      gameId: true,
      gameKind: true,
      status: true,
      maxEntries: true,
      countryCode: true,
      startsAt: true,
      endsAt: true,
    },
  });
  res.json({ tournaments: list });
});
