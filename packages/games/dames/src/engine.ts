import type {
  ApplyResult,
  MatchConfig,
  Outcome,
  PlayerId,
  PlayerStatDelta,
  ValidationResult,
} from '@nexplay/game-core';
import {
  BOARD_SIZE,
  colOf,
  inBounds,
  idx,
  isDarkSquare,
  manForwardDelta,
  opponent,
  promotionRow,
  rowOf,
  setupInitialBoard,
  type Piece,
  type Side,
} from './board.js';

export type DamesAction = {
  type: 'move';
  from: number;
  to: number;
};

export type DamesState = {
  matchId: string;
  board: (Piece | null)[];
  /** Seat 0 = dark (commence), seat 1 = light */
  sides: Record<Side, PlayerId>;
  currentSide: Side;
  /** Si multi-prise en cours, case de la pièce qui doit continuer */
  continueFrom: number | null;
  turnNumber: number;
  status: 'active' | 'finished';
  winnerId: PlayerId | null;
  reason: string | null;
  capturedCount: Record<Side, number>;
};

type JumpMove = { from: number; to: number; over: number };

function cloneState(state: DamesState): DamesState {
  return structuredClone(state);
}

function sideOfPlayer(state: DamesState, playerId: PlayerId): Side | null {
  if (state.sides.dark === playerId) return 'dark';
  if (state.sides.light === playerId) return 'light';
  return null;
}

function deltasFor(piece: Piece): [number, number][] {
  if (piece.king) {
    return [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
  }
  const f = manForwardDelta(piece.side);
  return [
    [f, -1],
    [f, 1],
  ];
}

function quietMovesFrom(board: (Piece | null)[], from: number): number[] {
  const piece = board[from];
  if (!piece) return [];
  const r = rowOf(from);
  const c = colOf(from);
  const dests: number[] = [];
  for (const [dr, dc] of deltasFor(piece)) {
    const nr = r + dr;
    const nc = c + dc;
    if (!inBounds(nr, nc)) continue;
    const to = idx(nr, nc);
    if (!isDarkSquare(to)) continue;
    if (board[to] === null) dests.push(to);
  }
  return dests;
}

function jumpMovesFrom(board: (Piece | null)[], from: number): JumpMove[] {
  const piece = board[from];
  if (!piece) return [];
  const r = rowOf(from);
  const c = colOf(from);
  const jumps: JumpMove[] = [];
  // Captures : diagonales adjacentes dans toutes les directions (y compris arrière pour les pions)
  const dirs: [number, number][] = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  for (const [dr, dc] of dirs) {
    const mr = r + dr;
    const mc = c + dc;
    const lr = r + dr * 2;
    const lc = c + dc * 2;
    if (!inBounds(mr, mc) || !inBounds(lr, lc)) continue;
    const mid = idx(mr, mc);
    const to = idx(lr, lc);
    if (!isDarkSquare(to)) continue;
    const victim = board[mid];
    if (!victim || victim.side === piece.side) continue;
    if (board[to] !== null) continue;
    // Pion : capture arrière autorisée en anglaise
    jumps.push({ from, to, over: mid });
  }
  return jumps;
}

function allJumpsForSide(board: (Piece | null)[], side: Side): JumpMove[] {
  const out: JumpMove[] = [];
  for (let i = 0; i < board.length; i++) {
    const p = board[i];
    if (!p || p.side !== side) continue;
    out.push(...jumpMovesFrom(board, i));
  }
  return out;
}

function allQuietForSide(board: (Piece | null)[], side: Side): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  for (let i = 0; i < board.length; i++) {
    const p = board[i];
    if (!p || p.side !== side) continue;
    for (const to of quietMovesFrom(board, i)) {
      out.push({ from: i, to });
    }
  }
  return out;
}

function hasAnyMove(board: (Piece | null)[], side: Side): boolean {
  if (allJumpsForSide(board, side).length > 0) return true;
  return allQuietForSide(board, side).length > 0;
}

function countPieces(board: (Piece | null)[], side: Side): number {
  return board.filter((p) => p?.side === side).length;
}

export function createDamesState(config: MatchConfig): DamesState {
  if (config.playerIds.length !== 2) {
    throw new Error('Dames requires exactly 2 players');
  }
  const [dark, light] = config.playerIds;
  return {
    matchId: String(config.options?.matchId ?? ''),
    board: setupInitialBoard(),
    sides: { dark: dark!, light: light! },
    currentSide: 'dark',
    continueFrom: null,
    turnNumber: 1,
    status: 'active',
    winnerId: null,
    reason: null,
    capturedCount: { dark: 0, light: 0 },
  };
}

export function getLegalDamesActions(state: DamesState, playerId: PlayerId): DamesAction[] {
  const side = sideOfPlayer(state, playerId);
  if (!side || state.status !== 'active') return [];
  if (side !== state.currentSide) return [];

  if (state.continueFrom !== null) {
    return jumpMovesFrom(state.board, state.continueFrom).map((j) => ({
      type: 'move' as const,
      from: j.from,
      to: j.to,
    }));
  }

  const jumps = allJumpsForSide(state.board, side);
  if (jumps.length > 0) {
    return jumps.map((j) => ({ type: 'move' as const, from: j.from, to: j.to }));
  }

  return allQuietForSide(state.board, side).map((m) => ({
    type: 'move' as const,
    from: m.from,
    to: m.to,
  }));
}

export function validateDamesAction(
  state: DamesState,
  action: DamesAction,
  playerId: PlayerId,
): ValidationResult {
  if (state.status !== 'active') {
    return { ok: false, code: 'FINISHED', message: 'Partie terminée' };
  }
  if (action.type !== 'move') {
    return { ok: false, code: 'UNKNOWN_ACTION', message: 'Action inconnue' };
  }
  const legal = getLegalDamesActions(state, playerId);
  const ok = legal.some((a) => a.from === action.from && a.to === action.to);
  if (!ok) {
    return { ok: false, code: 'ILLEGAL', message: 'Coup illégal' };
  }
  return { ok: true };
}

export function applyDamesAction(state: DamesState, action: DamesAction): ApplyResult<DamesState> {
  const next = cloneState(state);
  const side = next.currentSide;
  const piece = next.board[action.from];
  if (!piece) throw new Error('No piece');

  const jumps = jumpMovesFrom(next.board, action.from);
  const jump = jumps.find((j) => j.to === action.to);

  next.board[action.from] = null;
  if (jump) {
    next.board[jump.over] = null;
    next.capturedCount[side] += 1;
  }
  let moved: Piece = { ...piece };
  if (!moved.king && rowOf(action.to) === promotionRow(moved.side)) {
    moved = { ...moved, king: true };
  }
  next.board[action.to] = moved;

  const events = [
    {
      type: jump ? 'capture' : 'move',
      payload: { from: action.from, to: action.to, side, king: moved.king },
    },
  ];

  if (jump) {
    const more = jumpMovesFrom(next.board, action.to);
    // Si promotion pendant une prise, on arrête la série (règle anglaise courante)
    if (more.length > 0 && !(moved.king && !piece.king)) {
      next.continueFrom = action.to;
      return { state: next, events };
    }
  }

  next.continueFrom = null;
  // Fin de tour
  const other = opponent(side);
  if (countPieces(next.board, other) === 0 || !hasAnyMove(next.board, other)) {
    next.status = 'finished';
    next.winnerId = next.sides[side];
    next.reason = countPieces(next.board, other) === 0 ? 'no_pieces' : 'no_moves';
    return { state: next, events: [...events, { type: 'game_over', payload: { winnerId: next.winnerId } }] };
  }

  next.currentSide = other;
  next.turnNumber += 1;
  return { state: next, events };
}

export function isDamesTerminal(state: DamesState): Outcome | null {
  if (state.status !== 'finished' || !state.winnerId) return null;
  return {
    kind: 'win',
    winnerIds: [state.winnerId],
    reason: state.reason ?? 'win',
  };
}

export function computeDamesStats(state: DamesState, outcome: Outcome): PlayerStatDelta[] {
  const players = [state.sides.dark, state.sides.light];
  return players.map((playerId) => {
    const won = outcome.winnerIds.includes(playerId);
    const side = sideOfPlayer(state, playerId)!;
    return {
      playerId,
      result: outcome.kind === 'draw' ? 'draw' : won ? 'win' : 'loss',
      xp: won ? 40 : 12,
      extras: { captures: state.capturedCount[side] },
    };
  });
}

/** Helpers tests */
export function __test_place(
  state: DamesState,
  square: number,
  piece: Piece | null,
): DamesState {
  const s = cloneState(state);
  s.board[square] = piece;
  return s;
}

export function __test_clearBoard(state: DamesState): DamesState {
  const s = cloneState(state);
  s.board = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => null);
  return s;
}

export { BOARD_SIZE, idx, isDarkSquare };
