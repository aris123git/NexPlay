import { prisma } from '../db.js';
import { ensureWallet } from '../wallet/service.js';
import { getActiveSeason } from '../seasons/service.js';
import { getUserClan } from '../clans/service.js';
import { unreadCount } from '../notifications/service.js';
import { nexplayTag } from '../identity/nexplay-id.js';

const AVATAR_PRESETS = [
  'lion',
  'eagle',
  'baobab',
  'mask',
  'drum',
  'sun',
  'falcon',
  'shield',
] as const;

export { AVATAR_PRESETS };

export function levelFromXp(xp: number): number {
  return Math.floor(xp / 100) + 1;
}

export function xpProgress(xp: number) {
  const level = levelFromXp(xp);
  const into = xp % 100;
  return { level, into, need: 100, ratio: into / 100 };
}

export async function getFullProfile(userId: string) {
  await ensureWallet(userId);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      profile: true,
      wallet: true,
      gameStats: true,
      badges: { include: { badge: true }, orderBy: { earnedAt: 'desc' } },
    },
  });

  const history = await prisma.matchPlayer.findMany({
    where: { userId },
    orderBy: { match: { finishedAt: 'desc' } },
    take: 20,
    include: {
      match: {
        select: {
          id: true,
          gameId: true,
          mode: true,
          status: true,
          finishedAt: true,
          winnerJson: true,
          createdAt: true,
        },
      },
    },
  });

  const totals = user.gameStats.reduce(
    (acc, s) => {
      acc.played += s.played;
      acc.wins += s.wins;
      acc.losses += s.losses;
      acc.draws += s.draws;
      return acc;
    },
    { played: 0, wins: 0, losses: 0, draws: 0 },
  );
  const winRate = totals.played ? Math.round((totals.wins / totals.played) * 1000) / 10 : 0;

  const season = await getActiveSeason();
  let seasonStanding = null;
  if (season) {
    seasonStanding = await prisma.seasonStanding.findUnique({
      where: {
        seasonId_userId_gameId: {
          seasonId: season.id,
          userId,
          gameId: 'all',
        },
      },
    });
  }

  const clanMembership = await getUserClan(userId);
  const unread = await unreadCount(userId);
  const progress = xpProgress(user.profile!.xp);

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      ...user.profile!,
      level: progress.level,
      nexplayTag: user.profile!.nexplayId
        ? nexplayTag(user.profile!.username, user.profile!.nexplayId)
        : `${user.profile!.username}#0000`,
    },
    xp: progress,
    wallet: { nexCoins: user.wallet?.nexCoins ?? 0 },
    stats: user.gameStats.map((s) => ({
      ...s,
      winRate: s.played ? Math.round((s.wins / s.played) * 1000) / 10 : 0,
    })),
    totals: { ...totals, winRate },
    badges: user.badges.map((b) => ({ ...b.badge, earnedAt: b.earnedAt })),
    history: history.map((h) => ({
      matchId: h.match.id,
      gameId: h.match.gameId,
      mode: h.match.mode,
      result: h.result,
      eloBefore: h.ratingBefore,
      eloAfter: h.ratingAfter,
      xpGained: h.xpGained,
      coinsGained: h.coinsGained,
      finishedAt: h.match.finishedAt,
      status: h.match.status,
    })),
    season: season
      ? {
          id: season.id,
          code: season.code,
          name: season.name,
          endsAt: season.endsAt,
          standing: seasonStanding,
        }
      : null,
    clan: clanMembership
      ? {
          id: clanMembership.clan.id,
          name: clanMembership.clan.name,
          tag: clanMembership.clan.tag,
          score: clanMembership.clan.score,
          role: clanMembership.role,
          members: clanMembership.clan._count.members,
          countryCode: clanMembership.clan.countryCode,
        }
      : null,
    unreadNotifications: unread,
    avatarPresets: AVATAR_PRESETS,
  };
}

export async function updateProfile(
  userId: string,
  data: {
    displayName?: string;
    bio?: string;
    countryCode?: string;
    avatarUrl?: string;
    locale?: string;
  },
) {
  const profile = await prisma.playerProfile.update({
    where: { userId },
    data: {
      ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
      ...(data.bio !== undefined ? { bio: data.bio } : {}),
      ...(data.countryCode !== undefined
        ? { countryCode: data.countryCode.toUpperCase() }
        : {}),
      ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      ...(data.locale !== undefined ? { locale: data.locale } : {}),
    },
  });
  return profile;
}
