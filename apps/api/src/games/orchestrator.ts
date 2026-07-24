import { createHash } from 'node:crypto';
import type { AnyGameModule, Outcome } from '@nexplay/game-core';
import { prisma } from '../db.js';
import { gameRegistry } from './register.js';

function hashState(state: unknown): string {
  return createHash('sha256').update(JSON.stringify(state)).digest('hex').slice(0, 16);
}

export class GameOrchestrator {
  getModule(gameId: string): AnyGameModule {
    return gameRegistry.require(gameId);
  }

  async createMatch(input: {
    gameId: string;
    mode: string;
    visibility: 'public' | 'private';
    playerIds: string[];
    region?: string;
    inviteCode?: string;
    /** Si true, autorise 1..maxPlayers (lobby privé). Sinon exige minPlayers. */
    allowPartial?: boolean;
  }) {
    const mod = this.getModule(input.gameId);
    const min = input.allowPartial ? 1 : mod.minPlayers;
    if (input.playerIds.length < min || input.playerIds.length > mod.maxPlayers) {
      throw new Error(
        `Player count must be ${min}–${mod.maxPlayers} for ${mod.id}`,
      );
    }

    const match = await prisma.match.create({
      data: {
        gameId: input.gameId,
        mode: input.mode,
        visibility: input.visibility,
        status: 'waiting',
        region: input.region ?? 'bf-ouaga',
        inviteCode: input.inviteCode,
        stateJson: '{}',
        players: {
          create: input.playerIds.map((userId, seat) => ({
            userId,
            seat,
            ratingBefore: 1000,
          })),
        },
      },
      include: { players: true },
    });

    return match;
  }

  async startMatch(matchId: string) {
    const match = await prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      include: { players: { orderBy: { seat: 'asc' } } },
    });
    if (match.status !== 'waiting') throw new Error('Match not waiting');

    const mod = this.getModule(match.gameId);
    if (match.players.length < mod.minPlayers) {
      throw new Error(`Need at least ${mod.minPlayers} players to start`);
    }
    const state = mod.createInitialState({
      modeId: match.mode,
      playerIds: match.players.map((p) => p.userId),
      options: { matchId: match.id },
    });

    const updated = await prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'active',
        startedAt: new Date(),
        stateJson: JSON.stringify(state),
      },
      include: {
        players: {
          orderBy: { seat: 'asc' },
          include: { user: { include: { profile: true } } },
        },
      },
    });

    try {
      const { setStatus } = await import('../presence/service.js');
      const { track } = await import('../analytics/service.js');
      const { getOrCreateMatchChannel } = await import('../chat/service.js');
      await getOrCreateMatchChannel(matchId);
      await track('match_start', updated.players[0]?.userId, {
        matchId,
        gameId: match.gameId,
        players: updated.players.length,
      });
      for (const p of updated.players) {
        await setStatus(p.userId, 'in_match', matchId);
      }
    } catch {
      /* best-effort */
    }

    return updated;
  }

  async applyPlayerAction(matchId: string, playerId: string, action: unknown) {
    const match = await prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      include: { players: true },
    });
    if (match.status !== 'active') throw new Error('Match not active');
    if (!match.players.some((p) => p.userId === playerId)) {
      throw new Error('Not a player in this match');
    }

    const mod = this.getModule(match.gameId);
    const state = JSON.parse(match.stateJson);
    const validation = mod.validateAction(state, action, playerId);
    if (!validation.ok) {
      const err = new Error(validation.message) as Error & { code?: string };
      err.code = validation.code;
      throw err;
    }

    const { state: nextState, events } = mod.applyAction(state, action);
    const seq = (await prisma.matchMove.count({ where: { matchId } })) + 1;
    const stateHash = hashState(nextState);

    await prisma.matchMove.create({
      data: {
        matchId,
        seq,
        playerId,
        actionJson: JSON.stringify(action),
        stateHash,
      },
    });

    const outcome: Outcome | null = mod.isTerminal(nextState);
    let finished = false;
    if (outcome) {
      finished = true;
      await this.finalizeMatch(matchId, nextState, outcome, mod);
    } else {
      await prisma.match.update({
        where: { id: matchId },
        data: { stateJson: JSON.stringify(nextState) },
      });
    }

    const publicState = this.toPublicState(nextState);
    return { state: publicState, events, outcome, finished, seq };
  }

  private async finalizeMatch(
    matchId: string,
    state: unknown,
    outcome: Outcome,
    mod: AnyGameModule,
  ) {
    const { coinsForResult, creditCoins, ensureWallet } = await import('../wallet/service.js');
    const { recordSeasonResult, getActiveSeason } = await import('../seasons/service.js');
    const { notify } = await import('../notifications/service.js');
    const { addClanScore } = await import('../clans/service.js');
    const { levelFromXp } = await import('../profile/service.js');

    const stats = mod.computeStats(state, outcome);
    const match = await prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      include: { players: true },
    });

    const activeSeason = await getActiveSeason();
    if (activeSeason && !match.seasonId) {
      await prisma.match.update({
        where: { id: matchId },
        data: { seasonId: activeSeason.id },
      });
    }

    const coinGrants: { userId: string; coins: number; result: string }[] = [];

    await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: matchId },
        data: {
          status: 'finished',
          finishedAt: new Date(),
          stateJson: JSON.stringify(state),
          winnerJson: JSON.stringify(outcome.winnerIds),
          ...(activeSeason ? { seasonId: activeSeason.id } : {}),
        },
      });

      for (const delta of stats) {
        const mp = match.players.find((p) => p.userId === delta.playerId);
        if (!mp) continue;
        const ratingAfter =
          mp.ratingBefore + (delta.eloDelta ?? (delta.result === 'win' ? 16 : -8));
        const coins = coinsForResult(delta.result);
        coinGrants.push({ userId: delta.playerId, coins, result: delta.result });

        await tx.matchPlayer.update({
          where: { id: mp.id },
          data: {
            result: delta.result,
            xpGained: delta.xp,
            ratingAfter,
            coinsGained: coins,
          },
        });

        await tx.playerProfile.update({
          where: { userId: delta.playerId },
          data: { xp: { increment: delta.xp } },
        });

        const existing = await tx.playerGameStat.findUnique({
          where: {
            userId_gameId: { userId: delta.playerId, gameId: match.gameId },
          },
        });
        if (!existing) {
          await tx.playerGameStat.create({
            data: {
              userId: delta.playerId,
              gameId: match.gameId,
              played: 1,
              wins: delta.result === 'win' ? 1 : 0,
              losses: delta.result === 'loss' ? 1 : 0,
              draws: delta.result === 'draw' ? 1 : 0,
              elo: ratingAfter,
              winStreak: delta.result === 'win' ? 1 : 0,
              bestStreak: delta.result === 'win' ? 1 : 0,
            },
          });
        } else {
          const nextStreak = delta.result === 'win' ? existing.winStreak + 1 : 0;
          await tx.playerGameStat.update({
            where: { id: existing.id },
            data: {
              played: { increment: 1 },
              wins: { increment: delta.result === 'win' ? 1 : 0 },
              losses: { increment: delta.result === 'loss' ? 1 : 0 },
              draws: { increment: delta.result === 'draw' ? 1 : 0 },
              elo: ratingAfter,
              winStreak: nextStreak,
              bestStreak: Math.max(existing.bestStreak, nextStreak),
            },
          });
        }

        const profile = await tx.playerProfile.findUniqueOrThrow({
          where: { userId: delta.playerId },
        });
        const newLevel = levelFromXp(profile.xp);
        if (newLevel !== profile.level) {
          await tx.playerProfile.update({
            where: { userId: delta.playerId },
            data: { level: newLevel },
          });
        }

        if (delta.result === 'win') {
          const badge = await tx.badge.findUnique({ where: { code: 'first_win' } });
          if (badge) {
            await tx.playerBadge.upsert({
              where: {
                userId_badgeId: { userId: delta.playerId, badgeId: badge.id },
              },
              create: { userId: delta.playerId, badgeId: badge.id },
              update: {},
            });
          }
        }
      }
    });

    // Side-effects hors transaction principale (wallet / saison / notifs / clan)
    for (const g of coinGrants) {
      await ensureWallet(g.userId);
      await creditCoins(g.userId, g.coins, 'match_reward', {
        matchId,
        result: g.result,
      });
      await recordSeasonResult({
        userId: g.userId,
        gameId: match.gameId,
        result: g.result as 'win' | 'loss' | 'draw' | 'abandon',
      });
      if (g.result === 'win') await addClanScore(g.userId, 10);

      const won = outcome.winnerIds.includes(g.userId);
      await notify({
        userId: g.userId,
        type: 'match_result',
        title: won ? 'Victoire !' : 'Partie terminée',
        body: won
          ? `Tu gagnes +${g.coins} NexCoins`
          : `Résultat enregistré (+${g.coins} NexCoins)`,
        data: { matchId, gameId: match.gameId, result: g.result, coins: g.coins },
      });
    }

    // V2 hooks — replay + analytics + presence (game-agnostic)
    try {
      const { createReplayForMatch } = await import('../replays/service.js');
      const replay = await createReplayForMatch(matchId);
      for (const g of coinGrants) {
        await notify({
          userId: g.userId,
          type: 'system',
          title: 'Replay disponible',
          body: `Code ${replay.shareCode} — revois ta partie`,
          data: { matchId, shareCode: replay.shareCode },
        });
      }
    } catch {
      /* replay best-effort */
    }
    try {
      const { track } = await import('../analytics/service.js');
      await track('match_end', coinGrants[0]?.userId, {
        matchId,
        gameId: match.gameId,
        players: coinGrants.length,
      });
    } catch {
      /* ignore */
    }
    try {
      const { setStatus } = await import('../presence/service.js');
      for (const g of coinGrants) {
        await setStatus(g.userId, 'online');
      }
    } catch {
      /* ignore */
    }
  }

  /** Masque le secret des dés avant envoi client */
  toPublicState(state: unknown): unknown {
    if (!state || typeof state !== 'object') return state;
    const copy = structuredClone(state) as Record<string, unknown>;
    if ('diceSecret' in copy) delete copy.diceSecret;
    if (copy.pendingDice && typeof copy.pendingDice === 'object') {
      const d = copy.pendingDice as Record<string, unknown>;
      copy.pendingDice = { value: d.value };
    }
    return copy;
  }

  async getPublicMatch(matchId: string) {
    const match = await prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      include: {
        players: {
          orderBy: { seat: 'asc' },
          include: { user: { include: { profile: true } } },
        },
        moves: { orderBy: { seq: 'asc' }, take: 200 },
      },
    });
    const state = match.stateJson !== '{}' ? this.toPublicState(JSON.parse(match.stateJson)) : null;
    return { ...match, state, stateJson: undefined };
  }
}

export const orchestrator = new GameOrchestrator();
