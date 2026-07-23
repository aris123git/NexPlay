/**
 * Tournament Engine générique — compatible INTEGRATED & EXTERNAL.
 * Ne dépend pas de GameModule : orchestre brackets + résultats.
 */

import { prisma } from '../db.js';
import { notify, notifyMany } from '../notifications/service.js';
import { creditCoins, REWARDS } from '../wallet/service.js';

export type BracketNode = {
  round: number;
  position: number;
  entryAId: string | null;
  entryBId: string | null;
  winnerEntryId: string | null;
  status: string;
};

/** Prochaine puissance de 2 >= n */
export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Génère un bracket single-elim à partir d’entrées seedées */
export function buildSingleElimBracket(entryIds: string[]): BracketNode[] {
  const size = nextPowerOfTwo(Math.max(entryIds.length, 2));
  const seeded = [...entryIds];
  while (seeded.length < size) seeded.push(`BYE:${seeded.length}`);

  const rounds = Math.log2(size);
  const nodes: BracketNode[] = [];

  // Round 1
  for (let i = 0; i < size / 2; i++) {
    const a = seeded[i * 2]!;
    const b = seeded[i * 2 + 1]!;
    const aBye = a.startsWith('BYE:');
    const bBye = b.startsWith('BYE:');
    let winner: string | null = null;
    let status = 'ready';
    if (aBye && !bBye) {
      winner = b;
      status = 'bye';
    } else if (bBye && !aBye) {
      winner = a;
      status = 'bye';
    } else if (aBye && bBye) {
      status = 'bye';
    }
    nodes.push({
      round: 1,
      position: i,
      entryAId: aBye ? null : a,
      entryBId: bBye ? null : b,
      winnerEntryId: winner,
      status,
    });
  }

  for (let r = 2; r <= rounds; r++) {
    const count = size / 2 ** r;
    for (let i = 0; i < count; i++) {
      nodes.push({
        round: r,
        position: i,
        entryAId: null,
        entryBId: null,
        winnerEntryId: null,
        status: 'pending',
      });
    }
  }

  // Advance byes into round 2
  propagateByes(nodes, rounds);
  return nodes;
}

function propagateByes(nodes: BracketNode[], maxRound: number) {
  for (let r = 1; r < maxRound; r++) {
    const current = nodes.filter((n) => n.round === r);
    for (const m of current) {
      if (!m.winnerEntryId) continue;
      const next = nodes.find(
        (n) => n.round === r + 1 && n.position === Math.floor(m.position / 2),
      );
      if (!next) continue;
      if (m.position % 2 === 0) next.entryAId = m.winnerEntryId;
      else next.entryBId = m.winnerEntryId;
      if (next.entryAId && next.entryBId) next.status = 'ready';
      else if (next.entryAId || next.entryBId) {
        // wait opponent
      }
    }
  }
}

export async function createTournament(input: {
  name: string;
  gameId: string;
  gameKind?: 'INTEGRATED' | 'EXTERNAL';
  format?: string;
  scope?: 'individual' | 'team';
  maxEntries?: number;
  seasonId?: string;
  countryCode?: string;
  rewardsJson?: string;
  createdById: string;
}) {
  const t = await prisma.tournament.create({
    data: {
      name: input.name,
      gameId: input.gameId,
      gameKind: input.gameKind ?? 'INTEGRATED',
      format: input.format ?? 'single_elim',
      scope: input.scope ?? 'individual',
      maxEntries: input.maxEntries ?? 32,
      seasonId: input.seasonId,
      countryCode: input.countryCode,
      rewardsJson: input.rewardsJson ?? JSON.stringify({ champion: REWARDS.tournamentChampion }),
      status: 'open',
    },
  });

  await notify({
    userId: input.createdById,
    type: 'tournament',
    title: 'Tournoi créé',
    body: `${t.name} est ouvert aux inscriptions`,
    data: { tournamentId: t.id },
  });

  return t;
}

export async function registerEntry(tournamentId: string, userId: string, clanId?: string) {
  const t = await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
  if (t.status !== 'open') throw new Error('REGISTRATION_CLOSED');
  const count = await prisma.tournamentEntry.count({ where: { tournamentId } });
  if (count >= t.maxEntries) throw new Error('TOURNAMENT_FULL');

  if (t.scope === 'individual') {
    const existing = await prisma.tournamentEntry.findFirst({
      where: { tournamentId, userId },
    });
    if (existing) return existing;
    const entry = await prisma.tournamentEntry.create({
      data: { tournamentId, userId, seed: count + 1 },
    });
    await notify({
      userId,
      type: 'tournament',
      title: 'Inscription confirmée',
      body: `Tu es inscrit à ${t.name}`,
      data: { tournamentId },
    });
    return entry;
  }

  if (!clanId) throw new Error('CLAN_REQUIRED');
  const existing = await prisma.tournamentEntry.findFirst({
    where: { tournamentId, clanId },
  });
  if (existing) return existing;
  return prisma.tournamentEntry.create({
    data: { tournamentId, clanId, seed: count + 1 },
  });
}

export async function startTournament(tournamentId: string) {
  const t = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    include: { entries: { orderBy: { seed: 'asc' } } },
  });
  if (t.entries.length < 2) throw new Error('NEED_2_ENTRIES');

  const entryIds = t.entries.map((e) => e.id);
  const bracket = buildSingleElimBracket(entryIds);

  await prisma.$transaction(async (tx) => {
    await tx.tournamentMatch.deleteMany({ where: { tournamentId } });
    for (const node of bracket) {
      await tx.tournamentMatch.create({
        data: {
          tournamentId,
          round: node.round,
          position: node.position,
          entryAId: node.entryAId,
          entryBId: node.entryBId,
          winnerEntryId: node.winnerEntryId,
          status: node.status,
        },
      });
    }
    await tx.tournament.update({
      where: { id: tournamentId },
      data: {
        status: 'running',
        bracketJson: JSON.stringify(bracket),
        startsAt: new Date(),
      },
    });
  });

  const userIds = t.entries.map((e) => e.userId).filter(Boolean) as string[];
  await notifyMany(userIds, {
    type: 'tournament',
    title: `${t.name} démarre`,
    body: 'Le tableau est généré — consulte tes matchs',
    data: { tournamentId },
  });

  return prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    include: { rounds: { orderBy: [{ round: 'asc' }, { position: 'asc' }] }, entries: true },
  });
}

export async function reportIntegratedWinner(
  tournamentMatchId: string,
  winnerEntryId: string,
) {
  return advanceWinner(tournamentMatchId, winnerEntryId);
}

export async function submitExternalResult(input: {
  tournamentMatchId: string;
  submittedById: string;
  winnerEntryId: string;
  evidenceUrl?: string;
  notes?: string;
}) {
  const tm = await prisma.tournamentMatch.findUniqueOrThrow({
    where: { id: input.tournamentMatchId },
    include: { tournament: true },
  });
  if (tm.tournament.gameKind !== 'EXTERNAL') throw new Error('NOT_EXTERNAL');

  await prisma.externalResult.create({
    data: {
      tournamentMatchId: input.tournamentMatchId,
      submittedById: input.submittedById,
      winnerEntryId: input.winnerEntryId,
      evidenceUrl: input.evidenceUrl,
      notes: input.notes,
      status: 'pending',
    },
  });

  await prisma.tournamentMatch.update({
    where: { id: input.tournamentMatchId },
    data: {
      status: 'awaiting_result',
      evidenceJson: JSON.stringify({
        evidenceUrl: input.evidenceUrl,
        notes: input.notes,
        winnerEntryId: input.winnerEntryId,
      }),
    },
  });

  return { status: 'awaiting_validation' };
}

/** Validation admin / organisateur du résultat externe */
export async function validateExternalResult(
  tournamentMatchId: string,
  approve: boolean,
  winnerEntryId?: string,
) {
  const tm = await prisma.tournamentMatch.findUniqueOrThrow({
    where: { id: tournamentMatchId },
  });
  if (!approve) {
    await prisma.tournamentMatch.update({
      where: { id: tournamentMatchId },
      data: { status: 'ready', evidenceJson: '{}' },
    });
    return { status: 'rejected' };
  }
  const winner =
    winnerEntryId ||
    (JSON.parse(tm.evidenceJson || '{}') as { winnerEntryId?: string }).winnerEntryId;
  if (!winner) throw new Error('NO_WINNER');
  await prisma.tournamentMatch.update({
    where: { id: tournamentMatchId },
    data: { resultValidated: true },
  });
  return advanceWinner(tournamentMatchId, winner);
}

async function advanceWinner(tournamentMatchId: string, winnerEntryId: string) {
  const tm = await prisma.tournamentMatch.findUniqueOrThrow({
    where: { id: tournamentMatchId },
    include: { tournament: { include: { rounds: true, entries: true } } },
  });

  await prisma.tournamentMatch.update({
    where: { id: tournamentMatchId },
    data: { winnerEntryId, status: 'completed' },
  });

  const loserId =
    tm.entryAId === winnerEntryId ? tm.entryBId : tm.entryAId;
  if (loserId) {
    await prisma.tournamentEntry.update({
      where: { id: loserId },
      data: { status: 'eliminated' },
    });
  }

  const maxRound = Math.max(...tm.tournament.rounds.map((r) => r.round), 1);
  if (tm.round === maxRound) {
    await prisma.tournament.update({
      where: { id: tm.tournamentId },
      data: { status: 'completed', endsAt: new Date() },
    });
    await prisma.tournamentEntry.update({
      where: { id: winnerEntryId },
      data: { status: 'winner', placement: 1 },
    });
    const winnerEntry = tm.tournament.entries.find((e) => e.id === winnerEntryId);
    if (winnerEntry?.userId) {
      await creditCoins(winnerEntry.userId, REWARDS.tournamentChampion, 'tournament', {
        tournamentId: tm.tournamentId,
        place: 1,
      });
      await notify({
        userId: winnerEntry.userId,
        type: 'tournament',
        title: 'Champion !',
        body: `Tu remportes ${tm.tournament.name} (+${REWARDS.tournamentChampion} NexCoins)`,
        data: { tournamentId: tm.tournamentId },
      });
    }
    return { completed: true, championEntryId: winnerEntryId };
  }

  const next = await prisma.tournamentMatch.findFirst({
    where: {
      tournamentId: tm.tournamentId,
      round: tm.round + 1,
      position: Math.floor(tm.position / 2),
    },
  });
  if (next) {
    const data =
      tm.position % 2 === 0
        ? { entryAId: winnerEntryId }
        : { entryBId: winnerEntryId };
    const updated = await prisma.tournamentMatch.update({
      where: { id: next.id },
      data: {
        ...data,
        status:
          (tm.position % 2 === 0 ? next.entryBId : next.entryAId) || data
            ? 'ready'
            : next.status,
      },
    });
    // Fix status if both slots filled
    const fresh = await prisma.tournamentMatch.findUniqueOrThrow({ where: { id: next.id } });
    if (fresh.entryAId && fresh.entryBId && fresh.status !== 'completed') {
      await prisma.tournamentMatch.update({
        where: { id: fresh.id },
        data: { status: 'ready' },
      });
    }
    void updated;
  }

  return { completed: false, winnerEntryId };
}

export async function getTournament(id: string) {
  return prisma.tournament.findUniqueOrThrow({
    where: { id },
    include: {
      entries: {
        include: {
          user: { include: { profile: true } },
          clan: true,
        },
      },
      rounds: { orderBy: [{ round: 'asc' }, { position: 'asc' }] },
      season: true,
    },
  });
}
