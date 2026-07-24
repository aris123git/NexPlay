import { prisma } from '../db.js';

export const REWARDS = {
  matchWin: 25,
  matchLoss: 8,
  matchDraw: 12,
  daily: 50,
  tournamentChampion: 500,
  tournamentTop4: 150,
} as const;

export async function ensureWallet(userId: string) {
  return prisma.wallet.upsert({
    where: { userId },
    create: { userId, nexCoins: 100 },
    update: {},
  });
}

export async function creditCoins(
  userId: string,
  amount: number,
  reason: string,
  meta: Record<string, unknown> = {},
) {
  if (amount === 0) return ensureWallet(userId);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.wallet.findUnique({ where: { userId } });
    const base = existing?.nexCoins ?? 100;
    const next = base + amount;
    if (next < 0) throw new Error('INSUFFICIENT_FUNDS');

    await tx.wallet.upsert({
      where: { userId },
      create: { userId, nexCoins: next },
      update: { nexCoins: next },
    });
    const fresh = await tx.wallet.findUniqueOrThrow({ where: { userId } });
    await tx.walletTransaction.create({
      data: {
        userId,
        amount,
        balanceAfter: fresh.nexCoins,
        reason,
        metaJson: JSON.stringify(meta),
      },
    });
    return fresh;
  });
}

export async function claimDaily(userId: string) {
  const dayKey = new Date().toISOString().slice(0, 10);
  const existing = await prisma.dailyRewardClaim.findUnique({
    where: { userId_dayKey: { userId, dayKey } },
  });
  if (existing) {
    return { ok: false as const, error: 'ALREADY_CLAIMED', dayKey };
  }
  await prisma.dailyRewardClaim.create({
    data: { userId, dayKey, amount: REWARDS.daily },
  });
  const wallet = await creditCoins(userId, REWARDS.daily, 'daily', { dayKey });
  return { ok: true as const, amount: REWARDS.daily, wallet, dayKey };
}

export function coinsForResult(result: string): number {
  if (result === 'win') return REWARDS.matchWin;
  if (result === 'draw') return REWARDS.matchDraw;
  return REWARDS.matchLoss;
}
