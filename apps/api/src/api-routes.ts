import { Router } from 'express';
import { customAlphabet } from 'nanoid';
import { z } from 'zod';
import { authMiddleware } from './auth/auth.js';
import { prisma } from './db.js';
import { listInstalledGames } from './games/register.js';
import { orchestrator } from './games/orchestrator.js';
import { matchmaking } from './matchmaking/service.js';

const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'nexplay-api', ts: Date.now() });
});

apiRouter.get('/games', async (_req, res) => {
  const catalog = await prisma.gameDefinition.findMany({ orderBy: { name: 'asc' } });
  const installed = listInstalledGames();
  res.json({
    catalog,
    installed,
  });
});

apiRouter.get('/leaderboard/:gameId', async (req, res) => {
  const stats = await prisma.playerGameStat.findMany({
    where: { gameId: req.params.gameId },
    orderBy: { elo: 'desc' },
    take: 50,
    include: { user: { include: { profile: true } } },
  });
  res.json({
    entries: stats.map((s, i) => ({
      rank: i + 1,
      elo: s.elo,
      wins: s.wins,
      played: s.played,
      username: s.user.profile?.username,
      displayName: s.user.profile?.displayName,
      countryCode: s.user.profile?.countryCode,
      level: s.user.profile?.level,
    })),
  });
});

const queueSchema = z.object({
  gameId: z.string().default('ludo'),
  mode: z.string().default('public-2'),
  playerCount: z.number().int().min(2).max(4).default(2),
  region: z.string().default('bf-ouaga'),
});

apiRouter.post('/matchmaking/queue', authMiddleware, async (req, res) => {
  const parsed = queueSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'VALIDATION' });

  const { gameId, mode, playerCount, region } = parsed.data;
  const stat = await prisma.playerGameStat.findUnique({
    where: { userId_gameId: { userId: req.user!.id, gameId } },
  });

  const ticket = {
    id: nanoid(),
    userId: req.user!.id,
    gameId,
    mode,
    playerCount,
    elo: stat?.elo ?? 1000,
    region,
    createdAt: Date.now(),
  };

  const { ready } = matchmaking.enqueue(ticket);
  if (!ready) {
    return res.json({ status: 'queued', ticket });
  }

  const match = await orchestrator.createMatch({
    gameId,
    mode,
    visibility: 'public',
    playerIds: ready.map((t) => t.userId),
    region,
  });
  const started = await orchestrator.startMatch(match.id);
  const publicMatch = await orchestrator.getPublicMatch(started.id);

  // Notify via socket handled by caller listening to match:ready — also return here
  const io = req.app.get('io');
  for (const t of ready) {
    io?.to(`user:${t.userId}`).emit('match:ready', { matchId: started.id });
  }

  return res.json({ status: 'matched', match: publicMatch });
});

apiRouter.delete('/matchmaking/queue', authMiddleware, (req, res) => {
  matchmaking.cancel(req.user!.id);
  res.json({ status: 'cancelled' });
});

const privateSchema = z.object({
  gameId: z.string().default('ludo'),
  mode: z.string().default('private-2'),
  playerCount: z.number().int().min(2).max(4).default(2),
});

apiRouter.post('/matches/private', authMiddleware, async (req, res) => {
  try {
    const parsed = privateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'VALIDATION' });
    const inviteCode = nanoid();
    const match = await orchestrator.createMatch({
      gameId: parsed.data.gameId,
      mode: parsed.data.mode,
      visibility: 'private',
      playerIds: [req.user!.id],
      inviteCode,
      allowPartial: true,
    });
    // Store expected player count in stateJson meta via mode; waiting for joins
    res.status(201).json({
      matchId: match.id,
      inviteCode,
      status: match.status,
      expectedPlayers: parsed.data.playerCount,
    });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

apiRouter.post('/matches/join/:code', authMiddleware, async (req, res) => {
  const match = await prisma.match.findFirst({
    where: { inviteCode: req.params.code.toUpperCase(), status: 'waiting' },
    include: { players: true, game: true },
  });
  if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
  if (match.players.some((p) => p.userId === req.user!.id)) {
    return res.json(await orchestrator.getPublicMatch(match.id));
  }
  if (match.players.length >= match.game.maxPlayers) {
    return res.status(409).json({ error: 'MATCH_FULL' });
  }

  await prisma.matchPlayer.create({
    data: {
      matchId: match.id,
      userId: req.user!.id,
      seat: match.players.length,
    },
  });

  const updated = await prisma.match.findUniqueOrThrow({
    where: { id: match.id },
    include: { players: true, game: true },
  });

  // Auto-start when enough players for mode (parse from mode suffix or min)
  const needed = Number(match.mode.split('-').pop()) || updated.game.minPlayers;
  if (updated.players.length >= needed) {
    await orchestrator.startMatch(match.id);
    const io = req.app.get('io');
    for (const p of updated.players) {
      io?.to(`user:${p.userId}`).emit('match:ready', { matchId: match.id });
    }
  }

  res.json(await orchestrator.getPublicMatch(match.id));
});

apiRouter.get('/matches/:id', authMiddleware, async (req, res) => {
  try {
    res.json(await orchestrator.getPublicMatch(req.params.id));
  } catch {
    res.status(404).json({ error: 'NOT_FOUND' });
  }
});

apiRouter.get('/matches/:id/history', authMiddleware, async (req, res) => {
  const moves = await prisma.matchMove.findMany({
    where: { matchId: req.params.id },
    orderBy: { seq: 'asc' },
  });
  res.json({
    moves: moves.map((m) => ({
      seq: m.seq,
      playerId: m.playerId,
      action: JSON.parse(m.actionJson),
      stateHash: m.stateHash,
      at: m.createdAt,
    })),
  });
});

apiRouter.get('/users/:username', async (req, res) => {
  const profile = await prisma.playerProfile.findUnique({
    where: { username: req.params.username },
    include: {
      user: {
        include: {
          gameStats: true,
          badges: { include: { badge: true } },
        },
      },
    },
  });
  if (!profile) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({
    profile: {
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      countryCode: profile.countryCode,
      level: profile.level,
      xp: profile.xp,
      bio: profile.bio,
    },
    stats: profile.user.gameStats,
    badges: profile.user.badges.map((b) => b.badge),
  });
});

// Stubs sociaux conservés — clans/tournois complets via platform-routes
apiRouter.get('/social/friends', authMiddleware, async (req, res) => {
  const rows = await prisma.friendship.findMany({
    where: {
      status: 'accepted',
      OR: [{ requesterId: req.user!.id }, { addresseeId: req.user!.id }],
    },
  });
  res.json({ friends: rows });
});
