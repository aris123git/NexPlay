import type {
  ApplyResult,
  GameEvent,
  MatchConfig,
  Outcome,
  PlayerId,
  PlayerStatDelta,
  ValidationResult,
} from '@nexplay/game-core';
import {
  COLORS_BY_SEAT,
  ENTRY_INDEX,
  HOME_STRETCH,
  PRE_HOME_INDEX,
  TOKENS_PER_PLAYER,
  TRACK_SIZE,
  type LudoColor,
  type TokenPos,
  isSafeTrack,
  trackDistanceFromEntry,
} from './board.js';
import { createDiceSecret, rollSecureDie, type DiceRoll } from './dice.js';

export type LudoAction =
  | { type: 'roll' }
  | { type: 'move'; tokenIndex: number }
  | { type: 'pass' };

export type LudoPlayerState = {
  playerId: PlayerId;
  seat: number;
  color: LudoColor;
  tokens: TokenPos[];
};

export type LudoState = {
  matchId: string;
  diceSecret: string;
  playerCount: number;
  players: LudoPlayerState[];
  currentSeat: number;
  /** Dés en attente d’un move ; null si doit roller */
  pendingDice: DiceRoll | null;
  consecutiveSixes: number;
  rollSeq: number;
  turnNumber: number;
  finishedOrder: PlayerId[];
  lastEvents: GameEvent[];
  status: 'active' | 'finished';
};

function cloneState(state: LudoState): LudoState {
  return structuredClone(state);
}

function playerById(state: LudoState, playerId: PlayerId): LudoPlayerState | undefined {
  return state.players.find((p) => p.playerId === playerId);
}

function currentPlayer(state: LudoState): LudoPlayerState {
  return state.players[state.currentSeat]!;
}

function advanceTurn(state: LudoState, extraTurn: boolean): void {
  state.pendingDice = null;
  if (extraTurn) {
    state.consecutiveSixes = 0;
    return;
  }
  state.consecutiveSixes = 0;
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const seat = (state.currentSeat + i) % n;
    const p = state.players[seat]!;
    if (!state.finishedOrder.includes(p.playerId)) {
      state.currentSeat = seat;
      state.turnNumber += 1;
      return;
    }
  }
}

function allTokensHome(p: LudoPlayerState): boolean {
  return p.tokens.every((t) => t.kind === 'home' && t.index === HOME_STRETCH - 1);
}

/**
 * Calcule la destination après un déplacement de `steps` depuis une position.
 * Retourne null si le coup est illégal (dépassement, etc.).
 */
export function computeDestination(
  color: LudoColor,
  from: TokenPos,
  steps: number,
): TokenPos | null {
  if (from.kind === 'yard') {
    if (steps !== 6) return null;
    return { kind: 'track', index: ENTRY_INDEX[color] };
  }

  if (from.kind === 'home') {
    const next = from.index + steps;
    if (next > HOME_STRETCH - 1) return null;
    return { kind: 'home', index: next };
  }

  // from track
  const dist = trackDistanceFromEntry(color, from.index);
  const preHomeDist = trackDistanceFromEntry(color, PRE_HOME_INDEX[color]);
  // Steps remaining on track before entering home stretch
  const remainingOnTrack = preHomeDist - dist;

  if (steps <= remainingOnTrack) {
    const nextIndex = (from.index + steps) % TRACK_SIZE;
    return { kind: 'track', index: nextIndex };
  }

  // Enter home stretch
  const intoHome = steps - remainingOnTrack - 1; // -1 because landing on pre-home then step into home[0]
  // Actually: when at pre-home and roll 1 → home[0]
  // remainingOnTrack = 0 when on pre-home
  if (remainingOnTrack < 0) return null;

  // Distance from current to home entry: remainingOnTrack steps to reach pre-home,
  // then next step enters home[0]
  const stepsAfterPreHome = steps - remainingOnTrack;
  // stepsAfterPreHome === 1 → home index 0
  const homeIndex = stepsAfterPreHome - 1;
  if (homeIndex < 0 || homeIndex > HOME_STRETCH - 1) return null;
  return { kind: 'home', index: homeIndex };
}

function findOccupants(
  state: LudoState,
  trackIndex: number,
  exceptPlayerId?: PlayerId,
): { player: LudoPlayerState; tokenIndex: number }[] {
  const hits: { player: LudoPlayerState; tokenIndex: number }[] = [];
  for (const p of state.players) {
    if (exceptPlayerId && p.playerId === exceptPlayerId) continue;
    p.tokens.forEach((t, tokenIndex) => {
      if (t.kind === 'track' && t.index === trackIndex) {
        hits.push({ player: p, tokenIndex });
      }
    });
  }
  return hits;
}

function applyCapture(state: LudoState, trackIndex: number, moverId: PlayerId): GameEvent[] {
  if (isSafeTrack(trackIndex)) return [];
  const events: GameEvent[] = [];
  const occupants = findOccupants(state, trackIndex, moverId);
  for (const { player, tokenIndex } of occupants) {
    // Bloc de 2+ pions adverses : immunité (règle maison classique)
    const samePlayerCount = player.tokens.filter(
      (t) => t.kind === 'track' && t.index === trackIndex,
    ).length;
    if (samePlayerCount >= 2) continue;

    player.tokens[tokenIndex] = { kind: 'yard', slot: tokenIndex };
    events.push({
      type: 'capture',
      payload: {
        victimId: player.playerId,
        tokenIndex,
        square: trackIndex,
        by: moverId,
      },
    });
  }
  return events;
}

export function getMovableTokens(state: LudoState, playerId: PlayerId): number[] {
  const p = playerById(state, playerId);
  if (!p || !state.pendingDice) return [];
  const steps = state.pendingDice.value;
  const movable: number[] = [];
  p.tokens.forEach((token, i) => {
    if (computeDestination(p.color, token, steps)) movable.push(i);
  });
  return movable;
}

export function createLudoState(config: MatchConfig): LudoState {
  const count = config.playerIds.length;
  if (count < 2 || count > 4) {
    throw new Error('Ludo requires 2–4 players');
  }
  const matchId = String(config.options?.matchId ?? `local-${Date.now()}`);
  const players: LudoPlayerState[] = config.playerIds.map((playerId, seat) => ({
    playerId,
    seat,
    color: COLORS_BY_SEAT[seat]!,
    tokens: Array.from({ length: TOKENS_PER_PLAYER }, (_, slot) => ({
      kind: 'yard' as const,
      slot,
    })),
  }));

  return {
    matchId,
    diceSecret: createDiceSecret(),
    playerCount: count,
    players,
    currentSeat: 0,
    pendingDice: null,
    consecutiveSixes: 0,
    rollSeq: 0,
    turnNumber: 1,
    finishedOrder: [],
    lastEvents: [],
    status: 'active',
  };
}

export function validateLudoAction(
  state: LudoState,
  action: LudoAction,
  playerId: PlayerId,
): ValidationResult {
  if (state.status !== 'active') {
    return { ok: false, code: 'MATCH_OVER', message: 'La partie est terminée' };
  }
  const current = currentPlayer(state);
  if (current.playerId !== playerId) {
    return { ok: false, code: 'NOT_YOUR_TURN', message: "Ce n'est pas votre tour" };
  }

  if (action.type === 'roll') {
    if (state.pendingDice) {
      return { ok: false, code: 'ALREADY_ROLLED', message: 'Déjà lancé — déplacez un pion' };
    }
    return { ok: true };
  }

  if (action.type === 'pass') {
    if (!state.pendingDice) {
      return { ok: false, code: 'MUST_ROLL', message: 'Lancez le dé d’abord' };
    }
    const movable = getMovableTokens(state, playerId);
    if (movable.length > 0) {
      return { ok: false, code: 'MUST_MOVE', message: 'Un coup légal existe' };
    }
    return { ok: true };
  }

  if (action.type === 'move') {
    if (!state.pendingDice) {
      return { ok: false, code: 'MUST_ROLL', message: 'Lancez le dé d’abord' };
    }
    if (action.tokenIndex < 0 || action.tokenIndex >= TOKENS_PER_PLAYER) {
      return { ok: false, code: 'BAD_TOKEN', message: 'Pion invalide' };
    }
    const token = current.tokens[action.tokenIndex]!;
    const dest = computeDestination(current.color, token, state.pendingDice.value);
    if (!dest) {
      return { ok: false, code: 'ILLEGAL_MOVE', message: 'Coup illégal' };
    }
    return { ok: true };
  }

  return { ok: false, code: 'UNKNOWN_ACTION', message: 'Action inconnue' };
}

export function applyLudoAction(state: LudoState, action: LudoAction): ApplyResult<LudoState> {
  const next = cloneState(state);
  const events: GameEvent[] = [];
  const player = currentPlayer(next);

  if (action.type === 'roll') {
    next.rollSeq += 1;
    const roll = rollSecureDie(next.diceSecret, next.matchId, next.rollSeq);
    next.pendingDice = roll;
    events.push({ type: 'dice', payload: { value: roll.value, seat: player.seat } });

    if (roll.value === 6) {
      next.consecutiveSixes += 1;
      if (next.consecutiveSixes >= 3) {
        events.push({ type: 'triple_six', payload: { playerId: player.playerId } });
        advanceTurn(next, false);
        next.lastEvents = events;
        return { state: next, events };
      }
    }

    const movable = getMovableTokens(next, player.playerId);
    if (movable.length === 0) {
      events.push({ type: 'no_move', payload: { playerId: player.playerId } });
      // 6 sans coup : on ne garde pas le tour extra (rien à jouer)
      advanceTurn(next, false);
    }

    next.lastEvents = events;
    return { state: next, events };
  }

  if (action.type === 'pass') {
    events.push({ type: 'pass', payload: { playerId: player.playerId } });
    advanceTurn(next, false);
    next.lastEvents = events;
    return { state: next, events };
  }

  // move
  const steps = next.pendingDice!.value;
  const from = player.tokens[action.tokenIndex]!;
  const dest = computeDestination(player.color, from, steps)!;
  player.tokens[action.tokenIndex] = dest;
  events.push({
    type: 'move',
    payload: {
      playerId: player.playerId,
      tokenIndex: action.tokenIndex,
      from,
      to: dest,
      steps,
    },
  });

  let captured = false;
  if (dest.kind === 'track') {
    const caps = applyCapture(next, dest.index, player.playerId);
    if (caps.length) {
      captured = true;
      events.push(...caps);
    }
  }

  let playerFinished = false;
  if (dest.kind === 'home' && dest.index === HOME_STRETCH - 1) {
    events.push({
      type: 'token_home',
      payload: { playerId: player.playerId, tokenIndex: action.tokenIndex },
    });
    if (allTokensHome(player) && !next.finishedOrder.includes(player.playerId)) {
      next.finishedOrder.push(player.playerId);
      playerFinished = true;
      events.push({
        type: 'player_finished',
        payload: { playerId: player.playerId, place: next.finishedOrder.length },
      });
    }
  }

  const activeLeft = next.players.filter((p) => !next.finishedOrder.includes(p.playerId));
  if (activeLeft.length <= 1 && next.finishedOrder.length >= 1) {
    for (const p of activeLeft) {
      if (!next.finishedOrder.includes(p.playerId)) next.finishedOrder.push(p.playerId);
    }
    next.status = 'finished';
    events.push({ type: 'match_over', payload: { order: next.finishedOrder } });
    next.pendingDice = null;
    next.lastEvents = events;
    return { state: next, events };
  }

  // Après un coup : 6 ou capture → rejouer ; joueur terminé → suivant ; sinon suivant
  next.pendingDice = null;
  if (playerFinished) {
    advanceTurn(next, false);
  } else if (steps === 6 || captured) {
    next.currentSeat = player.seat;
    if (steps !== 6) next.consecutiveSixes = 0;
  } else {
    advanceTurn(next, false);
  }

  next.lastEvents = events;
  return { state: next, events };
}

export function getLegalLudoActions(state: LudoState, playerId: PlayerId): LudoAction[] {
  const current = currentPlayer(state);
  if (current.playerId !== playerId || state.status !== 'active') return [];
  if (!state.pendingDice) return [{ type: 'roll' }];
  const tokens = getMovableTokens(state, playerId);
  if (tokens.length === 0) return [{ type: 'pass' }];
  return tokens.map((tokenIndex) => ({ type: 'move' as const, tokenIndex }));
}

export function isLudoTerminal(state: LudoState): Outcome | null {
  if (state.status !== 'finished' || state.finishedOrder.length === 0) return null;
  return {
    kind: 'win',
    winnerIds: [state.finishedOrder[0]!],
    reason: 'all_tokens_home',
  };
}

export function computeLudoStats(state: LudoState, outcome: Outcome): PlayerStatDelta[] {
  return state.players.map((p) => {
    const place = state.finishedOrder.indexOf(p.playerId);
    const isWinner = outcome.winnerIds.includes(p.playerId);
    return {
      playerId: p.playerId,
      result: isWinner ? 'win' : place >= 0 ? 'loss' : 'abandon',
      xp: isWinner ? 50 : place === 1 ? 30 : place === 2 ? 20 : 10,
      extras: { place: place >= 0 ? place + 1 : state.players.length },
    };
  });
}

/** Exposé pour tests : force un dé pending */
export function __test_setPendingDice(state: LudoState, value: number): LudoState {
  const next = cloneState(state);
  next.pendingDice = {
    value,
    nonce: 't',
    signature: 't',
    at: 0,
  };
  return next;
}
