import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from './auth/auth.js';
import { prisma } from './db.js';
import * as presence from './presence/service.js';
import * as friends from './friends/service.js';
import * as chat from './chat/service.js';
import * as replays from './replays/service.js';
import * as analytics from './analytics/service.js';
import * as admin from './admin/service.js';
import { orchestrator } from './games/orchestrator.js';
import { customAlphabet } from 'nanoid';
import { notify } from './notifications/service.js';

const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

export const v2Router = Router();

function staffGuard(req: { user?: { id: string } }, res: { status: (n: number) => { json: (b: unknown) => unknown } }, next: () => void) {
  void (async () => {
    try {
      await admin.requireStaff(req.user!.id);
      next();
    } catch {
      res.status(403).json({ error: 'FORBIDDEN' });
    }
  })();
}

// —— Presence ——
v2Router.get('/presence/stats', (_req, res) => {
  res.json({ onlineCount: presence.onlineCount(), online: presence.getLiveSnapshot() });
});

v2Router.get('/presence/:userId', async (req, res) => {
  const [p] = await presence.getPresences([req.params.userId]);
  res.json({ presence: p });
});

v2Router.post('/presence/batch', authMiddleware, async (req, res) => {
  const ids = Array.isArray(req.body?.userIds) ? (req.body.userIds as string[]).slice(0, 100) : [];
  res.json({ presences: await presence.getPresences(ids) });
});

// —— Friends ——
v2Router.get('/friends', authMiddleware, async (req, res) => {
  const [list, pending] = await Promise.all([
    friends.listFriends(req.user!.id),
    friends.listPending(req.user!.id),
  ]);
  res.json({ friends: list, pending });
});

v2Router.post('/friends/request', authMiddleware, async (req, res) => {
  try {
    const username = String(req.body?.username ?? '');
    const row = await friends.sendFriendRequest(req.user!.id, username);
    res.status(201).json({ friendship: row });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

v2Router.post('/friends/:id/respond', authMiddleware, async (req, res) => {
  try {
    const accept = Boolean(req.body?.accept);
    res.json({
      friendship: await friends.respondFriendRequest(req.user!.id, req.params.id, accept),
    });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

v2Router.post('/friends/block', authMiddleware, async (req, res) => {
  try {
    res.json({
      friendship: await friends.blockUser(req.user!.id, String(req.body?.username ?? '')),
    });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

v2Router.post('/friends/unblock', authMiddleware, async (req, res) => {
  try {
    res.json(await friends.unblockUser(req.user!.id, String(req.body?.username ?? '')));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

v2Router.post('/friends/favorite', authMiddleware, async (req, res) => {
  try {
    const friendId = String(req.body?.friendId ?? '');
    const favorite = Boolean(req.body?.favorite);
    res.json(await friends.setFavorite(req.user!.id, friendId, favorite));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/** Rejoindre un ami directement (crée partie privée + invite) */
v2Router.post('/friends/join', authMiddleware, async (req, res) => {
  try {
    const friendId = String(req.body?.friendId ?? '');
    if (!(await friends.areFriends(req.user!.id, friendId))) {
      return res.status(403).json({ error: 'NOT_FRIENDS' });
    }
    const [p] = await presence.getPresences([friendId]);
    if (p?.status === 'in_match' && p.matchId) {
      // Spectate not yet — invite to new game instead if in match
    }
    const match = await orchestrator.createMatch({
      gameId: String(req.body?.gameId ?? 'ludo'),
      mode: 'private-2',
      visibility: 'private',
      playerIds: [req.user!.id],
      inviteCode: nanoid(),
      allowPartial: true,
    });
    await prisma.matchInvite.create({
      data: {
        fromUserId: req.user!.id,
        toUserId: friendId,
        gameId: String(req.body?.gameId ?? 'ludo'),
        mode: 'private-2',
        matchId: match.id,
      },
    });
    const me = await prisma.playerProfile.findUniqueOrThrow({
      where: { userId: req.user!.id },
    });
    await notify({
      userId: friendId,
      type: 'match_invite',
      title: 'Ton ami t’invite',
      body: `@${me.username} veut jouer maintenant`,
      data: { matchId: match.id, inviteCode: match.inviteCode },
    });
    await presence.setStatus(req.user!.id, 'in_queue');
    res.status(201).json({ matchId: match.id, inviteCode: match.inviteCode });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// —— Chat ——
v2Router.get('/chat/emojis', (_req, res) => {
  res.json({ emojis: chat.emojiCatalog });
});

v2Router.post('/chat/dm', authMiddleware, async (req, res) => {
  try {
    const otherId = String(req.body?.userId ?? '');
    const channel = await chat.getOrCreateDm(req.user!.id, otherId);
    const messages = await chat.listMessages(channel.id);
    res.json({ channel, messages });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

v2Router.post('/chat/clan', authMiddleware, async (req, res) => {
  try {
    const channel = await chat.getOrCreateClanChannel(req.user!.id);
    const messages = await chat.listMessages(channel.id);
    res.json({ channel, messages });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

v2Router.post('/chat/tournament/:id', authMiddleware, async (req, res) => {
  try {
    const channel = await chat.getOrCreateTournamentChannel(req.params.id);
    const messages = await chat.listMessages(channel.id);
    res.json({ channel, messages });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

v2Router.get('/chat/channels/:id/messages', authMiddleware, async (req, res) => {
  res.json({ messages: await chat.listMessages(req.params.id) });
});

v2Router.post('/chat/messages', authMiddleware, async (req, res) => {
  try {
    const msg = await chat.postMessage({
      channelId: String(req.body?.channelId ?? ''),
      senderId: req.user!.id,
      body: String(req.body?.body ?? ''),
    });
    res.status(201).json({ message: msg });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

v2Router.post('/chat/report', authMiddleware, async (req, res) => {
  try {
    const report = await chat.reportMessage(
      req.user!.id,
      String(req.body?.messageId ?? ''),
      String(req.body?.reason ?? 'abuse'),
    );
    res.status(201).json({ report });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// —— Replays ——
v2Router.get('/replays/me', authMiddleware, async (req, res) => {
  res.json({ replays: await replays.listUserReplays(req.user!.id) });
});

v2Router.get('/replays/:code', async (req, res) => {
  const replay = await replays.getReplayByCode(req.params.code);
  if (!replay) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ replay });
});

v2Router.post('/replays/report-cheat', authMiddleware, async (req, res) => {
  try {
    const report = await replays.reportCheat(
      req.user!.id,
      String(req.body?.matchId ?? ''),
      String(req.body?.reason ?? 'suspicious'),
    );
    res.status(201).json({ report });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// —— Analytics (public summary + admin full) ——
v2Router.get('/analytics/overview', async (_req, res) => {
  res.json(await analytics.getDashboard(presence.onlineCount()));
});

v2Router.post('/analytics/event', authMiddleware, async (req, res) => {
  const name = String(req.body?.name ?? '').slice(0, 64);
  if (!name) return res.status(400).json({ error: 'NAME_REQUIRED' });
  await analytics.track(name, req.user!.id, req.body?.props ?? {});
  res.status(201).json({ ok: true });
});

// —— Admin ——
v2Router.get('/admin/stats', authMiddleware, staffGuard, async (_req, res) => {
  res.json({
    ...(await admin.globalStats()),
    dashboard: await analytics.getDashboard(presence.onlineCount()),
  });
});

v2Router.get('/admin/users', authMiddleware, staffGuard, async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  res.json({ users: await admin.listUsers(50, q) });
});

v2Router.post('/admin/users/:id/ban', authMiddleware, staffGuard, async (req, res) => {
  try {
    res.json({
      user: await admin.banUser(req.user!.id, req.params.id, String(req.body?.reason ?? 'violation')),
    });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

v2Router.post('/admin/users/:id/unban', authMiddleware, staffGuard, async (req, res) => {
  try {
    res.json({ user: await admin.unbanUser(req.user!.id, req.params.id) });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

v2Router.post('/admin/users/:id/role', authMiddleware, async (req, res) => {
  try {
    await admin.requireAdmin(req.user!.id);
    res.json({
      user: await admin.setRole(req.user!.id, req.params.id, String(req.body?.role ?? 'player')),
    });
  } catch (e) {
    res.status(403).json({ error: (e as Error).message });
  }
});

v2Router.post('/admin/rewards', authMiddleware, async (req, res) => {
  try {
    await admin.requireAdmin(req.user!.id);
    const schema = z.object({
      userId: z.string(),
      amount: z.number().int(),
      reason: z.string().min(1).max(200),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'VALIDATION' });
    res.json({
      wallet: await admin.grantCoins(
        req.user!.id,
        parsed.data.userId,
        parsed.data.amount,
        parsed.data.reason,
      ),
    });
  } catch (e) {
    res.status(403).json({ error: (e as Error).message });
  }
});

v2Router.post('/admin/seasons', authMiddleware, async (req, res) => {
  try {
    await admin.requireAdmin(req.user!.id);
    const schema = z.object({
      code: z.string().min(2).max(20),
      name: z.string().min(3).max(80),
      startsAt: z.string(),
      endsAt: z.string(),
      activate: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'VALIDATION' });
    res.status(201).json({ season: await admin.createSeason(req.user!.id, parsed.data) });
  } catch (e) {
    res.status(403).json({ error: (e as Error).message });
  }
});

v2Router.get('/admin/reports', authMiddleware, staffGuard, async (_req, res) => {
  res.json(await admin.listOpenReports());
});

v2Router.post('/admin/chat/moderate', authMiddleware, staffGuard, async (req, res) => {
  try {
    const messageId = String(req.body?.messageId ?? '');
    const action = req.body?.action === 'dismiss_reports' ? 'dismiss_reports' : 'delete';
    res.json(await chat.moderateMessage(req.user!.id, messageId, action));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

v2Router.post('/admin/cheat/:id/resolve', authMiddleware, staffGuard, async (req, res) => {
  try {
    const status = req.body?.status === 'dismissed' ? 'dismissed' : 'actioned';
    res.json({
      report: await admin.resolveCheatReport(req.user!.id, req.params.id, status),
    });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

v2Router.get('/admin/audit', authMiddleware, staffGuard, async (_req, res) => {
  res.json({ logs: await admin.listAudit() });
});
