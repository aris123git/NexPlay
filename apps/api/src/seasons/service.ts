import { prisma } from '../db.js';
import { notify } from '../notifications/service.js';

export async function getActiveSeason() {
  const now = new Date();
  return prisma.season.findFirst({
    where: {
      status: 'active',
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
  });
}

export async function listSeasons() {
  return prisma.season.findMany({ orderBy: { startsAt: 'desc' } });
}

export async function recordSeasonResult(input: {
  userId: string;
  gameId: string;
  result: 'win' | 'loss' | 'draw' | 'abandon';
}) {
  const season = await getActiveSeason();
  if (!season) return null;

  const points =
    input.result === 'win' ? 3 : input.result === 'draw' ? 1 : 0;

  const upsert = async (gameId: string) => {
    const existing = await prisma.seasonStanding.findUnique({
      where: {
        seasonId_userId_gameId: {
          seasonId: season.id,
          userId: input.userId,
          gameId,
        },
      },
    });
    if (!existing) {
      return prisma.seasonStanding.create({
        data: {
          seasonId: season.id,
          userId: input.userId,
          gameId,
          points,
          wins: input.result === 'win' ? 1 : 0,
          losses: input.result === 'loss' || input.result === 'abandon' ? 1 : 0,
          played: 1,
        },
      });
    }
    return prisma.seasonStanding.update({
      where: { id: existing.id },
      data: {
        points: { increment: points },
        wins: { increment: input.result === 'win' ? 1 : 0 },
        losses: {
          increment: input.result === 'loss' || input.result === 'abandon' ? 1 : 0,
        },
        played: { increment: 1 },
      },
    });
  };

  await upsert('all');
  await upsert(input.gameId);
  return season;
}

export async function getSeasonLeaderboard(seasonId: string, gameId = 'all', take = 50) {
  const rows = await prisma.seasonStanding.findMany({
    where: { seasonId, gameId },
    orderBy: [{ points: 'desc' }, { wins: 'desc' }],
    take,
    include: { user: { include: { profile: true } } },
  });
  return rows.map((r, i) => ({
    rank: i + 1,
    points: r.points,
    wins: r.wins,
    losses: r.losses,
    played: r.played,
    userId: r.userId,
    username: r.user.profile?.username,
    displayName: r.user.profile?.displayName,
    countryCode: r.user.profile?.countryCode,
    avatarUrl: r.user.profile?.avatarUrl,
    level: r.user.profile?.level,
  }));
}

export async function completeSeasonIfDue() {
  const now = new Date();
  const due = await prisma.season.findMany({
    where: { status: 'active', endsAt: { lt: now } },
  });
  for (const s of due) {
    await prisma.season.update({ where: { id: s.id }, data: { status: 'completed' } });
    const top = await getSeasonLeaderboard(s.id, 'all', 3);
    for (const entry of top) {
      await notify({
        userId: entry.userId,
        type: 'season',
        title: `${s.name} terminée`,
        body: `Tu termines #${entry.rank} avec ${entry.points} pts`,
        data: { seasonId: s.id, rank: entry.rank },
      });
    }
  }
}
