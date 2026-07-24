import { prisma } from '../db.js';

export async function track(
  name: string,
  userId?: string | null,
  props: Record<string, unknown> = {},
) {
  await prisma.analyticsEvent.create({
    data: {
      name,
      userId: userId ?? null,
      propsJson: JSON.stringify(props),
    },
  });
}

function daysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Rétention approximative : users avec login/session_start à J0 qui reviennent à Jn */
export async function retentionCohort() {
  const start = daysAgo(30);
  const events = await prisma.analyticsEvent.findMany({
    where: {
      name: { in: ['login', 'session_start'] },
      createdAt: { gte: start },
      userId: { not: null },
    },
    select: { userId: true, createdAt: true },
  });

  const byUser = new Map<string, Date[]>();
  for (const e of events) {
    if (!e.userId) continue;
    const arr = byUser.get(e.userId) ?? [];
    arr.push(e.createdAt);
    byUser.set(e.userId, arr);
  }

  // Cohort = users whose first event in window is in last 30d first-day buckets is heavy;
  // Simplified: among users active on day 0 relative to first seen, % active on +1/+7/+30
  let cohort = 0;
  let d1 = 0;
  let d7 = 0;
  let d30 = 0;

  for (const [, dates] of byUser) {
    dates.sort((a, b) => a.getTime() - b.getTime());
    const first = dates[0]!;
    cohort += 1;
    const daySet = new Set(
      dates.map((d) => Math.floor((d.getTime() - first.getTime()) / 86_400_000)),
    );
    if ([...daySet].some((d) => d >= 1 && d <= 2)) d1 += 1;
    if ([...daySet].some((d) => d >= 6 && d <= 8)) d7 += 1;
    if ([...daySet].some((d) => d >= 28 && d <= 32)) d30 += 1;
  }

  const pct = (n: number) => (cohort ? Math.round((n / cohort) * 1000) / 10 : 0);
  return {
    cohortSize: cohort,
    d1: pct(d1),
    d7: pct(d7),
    d30: pct(d30),
  };
}

export async function getDashboard(onlineCount: number) {
  const finished = await prisma.match.findMany({
    where: { status: 'finished', finishedAt: { not: null }, startedAt: { not: null } },
    select: { gameId: true, startedAt: true, finishedAt: true },
    take: 2000,
    orderBy: { finishedAt: 'desc' },
  });

  const durations = finished
    .map((m) => (m.finishedAt!.getTime() - m.startedAt!.getTime()) / 1000)
    .filter((s) => s > 0 && s < 86_400);
  const avgDurationSec = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const byGame = new Map<string, number>();
  for (const m of finished) {
    byGame.set(m.gameId, (byGame.get(m.gameId) ?? 0) + 1);
  }
  const topGames = [...byGame.entries()]
    .map(([gameId, count]) => ({ gameId, count }))
    .sort((a, b) => b.count - a.count);

  const countries = await prisma.playerProfile.groupBy({
    by: ['countryCode'],
    _count: { countryCode: true },
    orderBy: { _count: { countryCode: 'desc' } },
    take: 15,
  });

  const usersTotal = await prisma.user.count({ where: { status: 'active' } });
  const matchesToday = await prisma.match.count({
    where: { createdAt: { gte: daysAgo(0) } },
  });
  const retention = await retentionCohort();

  return {
    onlineCount,
    usersTotal,
    matchesToday,
    avgDurationSec,
    topGames,
    topCountries: countries.map((c) => ({
      countryCode: c.countryCode,
      players: c._count.countryCode,
    })),
    retention,
    generatedAt: new Date().toISOString(),
  };
}
