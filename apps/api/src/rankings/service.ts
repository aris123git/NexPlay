import { prisma } from '../db.js';
import { CONTINENTS, resolveContinent } from '../i18n/catalog.js';

export type RankScope = 'world' | 'continent' | 'country' | 'region';

/**
 * Classements mondiaux — agrégation sur PlayerGameStat / SeasonStanding / Clan.
 * Agnostique du jeu (filtre gameId optionnel).
 */
export async function gameLeaderboard(input: {
  gameId: string;
  scope?: RankScope;
  continentCode?: string;
  countryCode?: string;
  regionName?: string;
  take?: number;
}) {
  const take = input.take ?? 50;
  const stats = await prisma.playerGameStat.findMany({
    where: { gameId: input.gameId },
    orderBy: [{ elo: 'desc' }, { wins: 'desc' }],
    take: 500,
    include: { user: { include: { profile: true } } },
  });

  let filtered = stats;
  const scope = input.scope ?? 'world';
  if (scope === 'continent' && input.continentCode) {
    filtered = stats.filter(
      (s) =>
        (s.user.profile?.continentCode ??
          resolveContinent(s.user.profile?.countryCode ?? 'BF')) ===
        input.continentCode,
    );
  } else if (scope === 'country' && input.countryCode) {
    filtered = stats.filter(
      (s) => s.user.profile?.countryCode === input.countryCode!.toUpperCase(),
    );
  } else if (scope === 'region' && input.regionName) {
    filtered = stats.filter(
      (s) =>
        (s.user.profile?.regionName ?? '').toLowerCase() ===
        input.regionName!.toLowerCase(),
    );
  }

  return filtered.slice(0, take).map((s, i) => ({
    rank: i + 1,
    userId: s.userId,
    username: s.user.profile?.username,
    displayName: s.user.profile?.displayName,
    avatarUrl: s.user.profile?.avatarUrl,
    countryCode: s.user.profile?.countryCode,
    continentCode:
      s.user.profile?.continentCode ??
      resolveContinent(s.user.profile?.countryCode ?? 'BF'),
    regionName: s.user.profile?.regionName,
    cityName: s.user.profile?.cityName,
    elo: s.elo,
    wins: s.wins,
    played: s.played,
    winRate: s.played ? Math.round((s.wins / s.played) * 1000) / 10 : 0,
  }));
}

export async function seasonLeaderboardScoped(input: {
  seasonId: string;
  gameId?: string;
  scope?: RankScope;
  continentCode?: string;
  countryCode?: string;
  take?: number;
}) {
  const take = input.take ?? 50;
  const gameId = input.gameId ?? 'all';
  const rows = await prisma.seasonStanding.findMany({
    where: { seasonId: input.seasonId, gameId },
    orderBy: [{ points: 'desc' }, { wins: 'desc' }],
    take: 500,
    include: { user: { include: { profile: true } } },
  });

  let filtered = rows;
  const scope = input.scope ?? 'world';
  if (scope === 'continent' && input.continentCode) {
    filtered = rows.filter(
      (r) =>
        (r.user.profile?.continentCode ??
          resolveContinent(r.user.profile?.countryCode ?? 'BF')) ===
        input.continentCode,
    );
  } else if (scope === 'country' && input.countryCode) {
    filtered = rows.filter(
      (r) => r.user.profile?.countryCode === input.countryCode!.toUpperCase(),
    );
  }

  return filtered.slice(0, take).map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    points: r.points,
    wins: r.wins,
    played: r.played,
    username: r.user.profile?.username,
    displayName: r.user.profile?.displayName,
    countryCode: r.user.profile?.countryCode,
    continentCode:
      r.user.profile?.continentCode ??
      resolveContinent(r.user.profile?.countryCode ?? 'BF'),
    avatarUrl: r.user.profile?.avatarUrl,
  }));
}

export async function clanLeaderboard(input: {
  scope?: RankScope;
  continentCode?: string;
  countryCode?: string;
  take?: number;
}) {
  const take = input.take ?? 50;
  const clans = await prisma.clan.findMany({
    orderBy: [{ score: 'desc' }, { rating: 'desc' }],
    take: 300,
    include: { _count: { select: { members: true } } },
  });

  let filtered = clans;
  const scope = input.scope ?? 'world';
  if (scope === 'continent' && input.continentCode) {
    filtered = clans.filter(
      (c) => resolveContinent(c.countryCode) === input.continentCode,
    );
  } else if (scope === 'country' && input.countryCode) {
    filtered = clans.filter(
      (c) => c.countryCode === input.countryCode!.toUpperCase(),
    );
  }

  return filtered.slice(0, take).map((c, i) => ({
    rank: i + 1,
    id: c.id,
    name: c.name,
    tag: c.tag,
    countryCode: c.countryCode,
    continentCode: resolveContinent(c.countryCode),
    score: c.score,
    rating: c.rating,
    members: c._count.members,
    logoUrl: c.logoUrl,
  }));
}

export function rankingMeta() {
  return {
    scopes: ['world', 'continent', 'country', 'region'] as RankScope[],
    continents: CONTINENTS,
  };
}
