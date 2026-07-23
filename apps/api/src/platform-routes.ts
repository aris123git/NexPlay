import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from './auth/auth.js';
import { prisma } from './db.js';
import * as notifications from './notifications/service.js';
import * as seasons from './seasons/service.js';
import * as wallet from './wallet/service.js';
import * as clans from './clans/service.js';
import * as profile from './profile/service.js';
import * as tournaments from './tournaments/engine.js';
import { orchestrator } from './games/orchestrator.js';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

export const platformRouter = Router();

// —— Notifications ——
platformRouter.get('/notifications', authMiddleware, async (req, res) => {
  const items = await notifications.listNotifications(req.user!.id);
  const unread = await notifications.unreadCount(req.user!.id);
  res.json({ items, unread });
});

platformRouter.post('/notifications/read', authMiddleware, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? (req.body.ids as string[]) : undefined;
  await notifications.markRead(req.user!.id, ids);
  res.json({ ok: true });
});

// —— Profile ——
platformRouter.get('/profile/me', authMiddleware, async (req, res) => {
  res.json(await profile.getFullProfile(req.user!.id));
});

platformRouter.patch('/profile/me', authMiddleware, async (req, res) => {
  const schema = z.object({
    displayName: z.string().min(1).max(40).optional(),
    bio: z.string().max(280).optional(),
    countryCode: z.string().length(2).optional(),
    avatarUrl: z.string().max(200).optional(),
    locale: z.string().max(12).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'VALIDATION' });
  const updated = await profile.updateProfile(req.user!.id, parsed.data);
  res.json({ profile: updated });
});

// —— Wallet / NexCoins ——
platformRouter.get('/wallet', authMiddleware, async (req, res) => {
  const w = await wallet.ensureWallet(req.user!.id);
  const ledger = await prisma.walletTransaction.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  res.json({ nexCoins: w.nexCoins, ledger });
});

platformRouter.post('/wallet/daily', authMiddleware, async (req, res) => {
  const result = await wallet.claimDaily(req.user!.id);
  if (!result.ok) return res.status(409).json(result);
  await notifications.notify({
    userId: req.user!.id,
    type: 'system',
    title: 'Récompense quotidienne',
    body: `+${result.amount} NexCoins`,
    data: { dayKey: result.dayKey },
  });
  res.json(result);
});

// —— Seasons ——
platformRouter.get('/seasons', async (_req, res) => {
  const list = await seasons.listSeasons();
  const active = await seasons.getActiveSeason();
  res.json({ seasons: list, active });
});

platformRouter.get('/seasons/:id/leaderboard', async (req, res) => {
  const gameId = typeof req.query.gameId === 'string' ? req.query.gameId : 'all';
  const entries = await seasons.getSeasonLeaderboard(req.params.id, gameId);
  res.json({ entries });
});

// —— Tournaments ——
platformRouter.get('/tournaments', async (_req, res) => {
  const list = await prisma.tournament.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: { _count: { select: { entries: true } }, season: true },
  });
  res.json({
    tournaments: list.map((t) => ({
      ...t,
      entryCount: t._count.entries,
      _count: undefined,
    })),
  });
});

platformRouter.post('/tournaments', authMiddleware, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(3).max(80),
      gameId: z.string().default('ludo'),
      gameKind: z.enum(['INTEGRATED', 'EXTERNAL']).default('INTEGRATED'),
      maxEntries: z.number().int().min(2).max(1024).default(32),
      scope: z.enum(['individual', 'team']).default('individual'),
      countryCode: z.string().length(2).optional(),
      seasonId: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'VALIDATION' });
    const active = await seasons.getActiveSeason();
    const t = await tournaments.createTournament({
      ...parsed.data,
      seasonId: parsed.data.seasonId ?? active?.id,
      createdById: req.user!.id,
    });
    res.status(201).json({ tournament: t });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

platformRouter.get('/tournaments/:id', async (req, res) => {
  try {
    res.json({ tournament: await tournaments.getTournament(req.params.id) });
  } catch {
    res.status(404).json({ error: 'NOT_FOUND' });
  }
});

platformRouter.post('/tournaments/:id/register', authMiddleware, async (req, res) => {
  try {
    const clanId = typeof req.body?.clanId === 'string' ? req.body.clanId : undefined;
    const entry = await tournaments.registerEntry(req.params.id, req.user!.id, clanId);
    res.json({ entry });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

platformRouter.post('/tournaments/:id/start', authMiddleware, async (req, res) => {
  try {
    const t = await tournaments.startTournament(req.params.id);
    res.json({ tournament: t });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

platformRouter.post(
  '/tournaments/matches/:matchId/advance',
  authMiddleware,
  async (req, res) => {
    try {
      const winnerEntryId = String(req.body?.winnerEntryId ?? '');
      if (!winnerEntryId) return res.status(400).json({ error: 'winnerEntryId required' });
      const result = await tournaments.reportIntegratedWinner(
        req.params.matchId,
        winnerEntryId,
      );
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  },
);

platformRouter.post(
  '/tournaments/matches/:matchId/external-result',
  authMiddleware,
  async (req, res) => {
    try {
      const schema = z.object({
        winnerEntryId: z.string(),
        evidenceUrl: z.string().url().optional(),
        notes: z.string().max(500).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'VALIDATION' });
      const result = await tournaments.submitExternalResult({
        tournamentMatchId: req.params.matchId,
        submittedById: req.user!.id,
        ...parsed.data,
      });
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  },
);

platformRouter.post(
  '/tournaments/matches/:matchId/validate',
  authMiddleware,
  async (req, res) => {
    try {
      const approve = Boolean(req.body?.approve);
      const winnerEntryId =
        typeof req.body?.winnerEntryId === 'string' ? req.body.winnerEntryId : undefined;
      const result = await tournaments.validateExternalResult(
        req.params.matchId,
        approve,
        winnerEntryId,
      );
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  },
);

// —— Clans ——
platformRouter.get('/clans', async (_req, res) => {
  res.json({ clans: await clans.listClans() });
});

platformRouter.get('/clans/:id', async (req, res) => {
  try {
    res.json({ clan: await clans.getClan(req.params.id) });
  } catch {
    res.status(404).json({ error: 'NOT_FOUND' });
  }
});

platformRouter.post('/clans', authMiddleware, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(3).max(40),
      tag: z.string().min(2).max(6),
      countryCode: z.string().length(2).optional(),
      description: z.string().max(280).optional(),
      logoUrl: z.string().max(200).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'VALIDATION' });
    const clan = await clans.createClan({ ...parsed.data, ownerId: req.user!.id });
    res.status(201).json({ clan });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

platformRouter.post('/clans/:id/join', authMiddleware, async (req, res) => {
  try {
    res.json({ clan: await clans.joinClan(req.params.id, req.user!.id) });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

platformRouter.post('/clans/leave', authMiddleware, async (req, res) => {
  try {
    res.json(await clans.leaveClan(req.user!.id));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// —— Match invites (notifications) ——
platformRouter.post('/invites', authMiddleware, async (req, res) => {
  try {
    const schema = z.object({
      toUsername: z.string().min(3),
      gameId: z.string().default('ludo'),
      mode: z.string().default('private-2'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'VALIDATION' });

    const target = await prisma.playerProfile.findUnique({
      where: { username: parsed.data.toUsername },
    });
    if (!target) return res.status(404).json({ error: 'USER_NOT_FOUND' });
    if (target.userId === req.user!.id) {
      return res.status(400).json({ error: 'CANNOT_INVITE_SELF' });
    }

    const match = await orchestrator.createMatch({
      gameId: parsed.data.gameId,
      mode: parsed.data.mode,
      visibility: 'private',
      playerIds: [req.user!.id],
      inviteCode: nanoid(),
      allowPartial: true,
    });

    const invite = await prisma.matchInvite.create({
      data: {
        fromUserId: req.user!.id,
        toUserId: target.userId,
        gameId: parsed.data.gameId,
        mode: parsed.data.mode,
        matchId: match.id,
      },
    });

    await notifications.notify({
      userId: target.userId,
      type: 'match_invite',
      title: 'Invitation de partie',
      body: `@${req.user!.username} t’invite à jouer (${parsed.data.gameId})`,
      data: {
        inviteId: invite.id,
        matchId: match.id,
        inviteCode: match.inviteCode,
        fromUsername: req.user!.username,
      },
    });

    res.status(201).json({ invite, matchId: match.id, inviteCode: match.inviteCode });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

platformRouter.post('/invites/:id/respond', authMiddleware, async (req, res) => {
  try {
    const accept = Boolean(req.body?.accept);
    const invite = await prisma.matchInvite.findUniqueOrThrow({
      where: { id: req.params.id },
    });
    if (invite.toUserId !== req.user!.id) return res.status(403).json({ error: 'FORBIDDEN' });
    if (invite.status !== 'pending') return res.status(409).json({ error: 'NOT_PENDING' });

    await prisma.matchInvite.update({
      where: { id: invite.id },
      data: { status: accept ? 'accepted' : 'declined' },
    });

    if (!accept) {
      await notifications.notify({
        userId: invite.fromUserId,
        type: 'match_invite',
        title: 'Invitation refusée',
        body: `@${req.user!.username} a décliné`,
        data: { inviteId: invite.id },
      });
      return res.json({ status: 'declined' });
    }

    if (!invite.matchId) return res.status(400).json({ error: 'NO_MATCH' });
    const match = await prisma.match.findUniqueOrThrow({
      where: { id: invite.matchId },
      include: { players: true, game: true },
    });
    if (!match.players.some((p) => p.userId === req.user!.id)) {
      await prisma.matchPlayer.create({
        data: {
          matchId: match.id,
          userId: req.user!.id,
          seat: match.players.length,
        },
      });
    }
    const updated = await prisma.match.findUniqueOrThrow({
      where: { id: match.id },
      include: { players: true, game: true },
    });
    const needed = Number(match.mode.split('-').pop()) || updated.game.minPlayers;
    if (updated.players.length >= needed && updated.status === 'waiting') {
      await orchestrator.startMatch(match.id);
    }

    await notifications.notify({
      userId: invite.fromUserId,
      type: 'match_invite',
      title: 'Invitation acceptée',
      body: `@${req.user!.username} a rejoint la partie`,
      data: { inviteId: invite.id, matchId: match.id },
    });

    res.json({ status: 'accepted', match: await orchestrator.getPublicMatch(match.id) });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
