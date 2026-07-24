import { customAlphabet } from 'nanoid';
import { prisma } from '../db.js';

const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

/**
 * Replays — construits automatiquement à la fin d’une partie
 * à partir des MatchMove (agnostique du jeu).
 */
export async function createReplayForMatch(matchId: string) {
  const match = await prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    include: {
      players: { include: { user: { include: { profile: true } } } },
      moves: { orderBy: { seq: 'asc' } },
    },
  });

  const existing = await prisma.matchReplay.findUnique({ where: { matchId } });
  if (existing) return existing;

  const durationMs =
    match.startedAt && match.finishedAt
      ? match.finishedAt.getTime() - match.startedAt.getTime()
      : null;

  const meta = {
    gameId: match.gameId,
    mode: match.mode,
    winners: JSON.parse(match.winnerJson || '[]'),
    players: match.players.map((p) => ({
      userId: p.userId,
      seat: p.seat,
      username: p.user.profile?.username,
      result: p.result,
      ratingBefore: p.ratingBefore,
      ratingAfter: p.ratingAfter,
    })),
    moveCount: match.moves.length,
  };

  return prisma.matchReplay.create({
    data: {
      matchId,
      gameId: match.gameId,
      shareCode: nanoid(),
      durationMs: durationMs ?? undefined,
      metaJson: JSON.stringify(meta),
      isPublic: true,
    },
  });
}

export async function getReplayByCode(shareCode: string) {
  const replay = await prisma.matchReplay.findUnique({
    where: { shareCode: shareCode.toUpperCase() },
    include: {
      match: {
        include: {
          players: {
            include: { user: { include: { profile: true } } },
            orderBy: { seat: 'asc' },
          },
          moves: { orderBy: { seq: 'asc' } },
        },
      },
    },
  });
  if (!replay || !replay.isPublic) return null;

  await prisma.matchReplay.update({
    where: { id: replay.id },
    data: { views: { increment: 1 } },
  });

  return {
    shareCode: replay.shareCode,
    gameId: replay.gameId,
    durationMs: replay.durationMs,
    views: replay.views + 1,
    meta: JSON.parse(replay.metaJson),
    createdAt: replay.createdAt,
    matchId: replay.matchId,
    moves: replay.match.moves.map((m) => ({
      seq: m.seq,
      playerId: m.playerId,
      action: JSON.parse(m.actionJson),
      stateHash: m.stateHash,
      at: m.createdAt,
    })),
    players: replay.match.players.map((p) => ({
      userId: p.userId,
      seat: p.seat,
      username: p.user.profile?.username,
      displayName: p.user.profile?.displayName,
      result: p.result,
    })),
    finalState: replay.match.stateJson !== '{}' ? JSON.parse(replay.match.stateJson) : null,
  };
}

export async function listUserReplays(userId: string, take = 20) {
  const played = await prisma.matchPlayer.findMany({
    where: { userId, match: { status: 'finished' } },
    select: { matchId: true },
    take: 100,
  });
  const ids = played.map((p) => p.matchId);
  return prisma.matchReplay.findMany({
    where: { matchId: { in: ids } },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function reportCheat(reporterId: string, matchId: string, reason: string) {
  return prisma.cheatReport.create({
    data: {
      matchId,
      reporterId,
      reason: reason.slice(0, 500),
    },
  });
}
