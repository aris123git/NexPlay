import { prisma } from '../db.js';
import { creditCoins } from '../wallet/service.js';
import { notify } from '../notifications/service.js';

type Goal = {
  type: 'wins' | 'matches' | 'elo_gain';
  gameId?: string;
  target: number;
};

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function weekKey(d = new Date()) {
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export async function seedChallenges() {
  const defs = [
    {
      code: `daily-win-${dayKey()}`,
      kind: 'daily',
      titleKey: 'event.daily.win',
      descriptionKey: 'event.daily.win.desc',
      goalJson: JSON.stringify({ type: 'wins', target: 1 } satisfies Goal),
      rewardJson: JSON.stringify({ nexCoins: 40 }),
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 86400000),
    },
    {
      code: `daily-play-${dayKey()}`,
      kind: 'daily',
      titleKey: 'event.daily.play',
      descriptionKey: 'event.daily.play.desc',
      goalJson: JSON.stringify({ type: 'matches', target: 2 } satisfies Goal),
      rewardJson: JSON.stringify({ nexCoins: 30 }),
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 86400000),
    },
    {
      code: `weekly-wins-${weekKey()}`,
      kind: 'weekly',
      titleKey: 'event.weekly.wins',
      descriptionKey: 'event.weekly.wins.desc',
      goalJson: JSON.stringify({ type: 'wins', target: 5 } satisfies Goal),
      rewardJson: JSON.stringify({ nexCoins: 200 }),
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 7 * 86400000),
    },
    {
      code: 'mission-first-10',
      kind: 'mission',
      titleKey: 'event.mission.ten',
      descriptionKey: 'event.mission.ten.desc',
      goalJson: JSON.stringify({ type: 'matches', target: 10 } satisfies Goal),
      rewardJson: JSON.stringify({ nexCoins: 150 }),
      isActive: true,
    },
    {
      code: 'seasonal-ludo-warrior',
      kind: 'seasonal',
      titleKey: 'event.seasonal.ludo',
      descriptionKey: 'event.seasonal.ludo.desc',
      goalJson: JSON.stringify({ type: 'wins', gameId: 'ludo', target: 15 } satisfies Goal),
      rewardJson: JSON.stringify({ nexCoins: 400, title: 'Guerrier Ludo' }),
      isActive: true,
    },
  ];

  for (const d of defs) {
    await prisma.challenge.upsert({
      where: { code: d.code },
      create: { ...d, isActive: true },
      update: { isActive: true, goalJson: d.goalJson, rewardJson: d.rewardJson },
    });
  }
}

export async function listActiveChallenges(userId: string) {
  const now = new Date();
  const challenges = await prisma.challenge.findMany({
    where: {
      isActive: true,
      OR: [{ endsAt: null }, { endsAt: { gte: now } }],
    },
    orderBy: { kind: 'asc' },
  });

  const progress = await prisma.challengeProgress.findMany({
    where: { userId, challengeId: { in: challenges.map((c) => c.id) } },
  });
  const map = new Map(progress.map((p) => [p.challengeId, p]));

  return challenges.map((c) => {
    const goal = JSON.parse(c.goalJson) as Goal;
    const p = map.get(c.id);
    return {
      id: c.id,
      code: c.code,
      kind: c.kind,
      titleKey: c.titleKey,
      descriptionKey: c.descriptionKey,
      goal,
      reward: JSON.parse(c.rewardJson || '{}'),
      endsAt: c.endsAt,
      progress: p?.progress ?? 0,
      completedAt: p?.completedAt ?? null,
      claimedAt: p?.claimedAt ?? null,
    };
  });
}

/** Appelé depuis finalizeMatch — agnostique du jeu */
export async function onMatchFinished(input: {
  userId: string;
  gameId: string;
  result: string;
  eloDelta?: number;
}) {
  const challenges = await prisma.challenge.findMany({
    where: {
      isActive: true,
      OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
    },
  });

  for (const c of challenges) {
    const goal = JSON.parse(c.goalJson) as Goal;
    if (goal.gameId && goal.gameId !== input.gameId) continue;

    let delta = 0;
    if (goal.type === 'matches') delta = 1;
    if (goal.type === 'wins' && input.result === 'win') delta = 1;
    if (goal.type === 'elo_gain' && (input.eloDelta ?? 0) > 0) {
      delta = input.eloDelta ?? 0;
    }
    if (!delta) continue;

    const existing = await prisma.challengeProgress.findUnique({
      where: {
        challengeId_userId: { challengeId: c.id, userId: input.userId },
      },
    });

    const next = (existing?.progress ?? 0) + delta;
    const completed = next >= goal.target;

    if (!existing) {
      await prisma.challengeProgress.create({
        data: {
          challengeId: c.id,
          userId: input.userId,
          progress: Math.min(next, goal.target),
          completedAt: completed ? new Date() : null,
        },
      });
    } else if (!existing.completedAt) {
      await prisma.challengeProgress.update({
        where: { id: existing.id },
        data: {
          progress: Math.min(next, goal.target),
          completedAt: completed ? new Date() : null,
        },
      });
    }

    if (completed && !existing?.completedAt) {
      await notify({
        userId: input.userId,
        type: 'system',
        title: 'Défi terminé',
        body: 'Réclame ta récompense dans Événements',
        data: { challengeId: c.id, code: c.code },
      });
    }
  }
}

export async function claimChallenge(userId: string, challengeId: string) {
  const c = await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId } });
  const p = await prisma.challengeProgress.findUnique({
    where: { challengeId_userId: { challengeId, userId } },
  });
  if (!p?.completedAt) throw new Error('NOT_COMPLETED');
  if (p.claimedAt) throw new Error('ALREADY_CLAIMED');

  const reward = JSON.parse(c.rewardJson || '{}') as { nexCoins?: number };
  const coins = reward.nexCoins ?? 0;
  if (coins) await creditCoins(userId, coins, 'event', { challengeId: c.id });

  await prisma.challengeProgress.update({
    where: { id: p.id },
    data: { claimedAt: new Date() },
  });

  return { coins, challengeId };
}
