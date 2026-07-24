/**
 * Dames (variante anglaise 8×8) — plateau et géométrie.
 * Cases jouables = cases sombres (r+c) % 2 === 1.
 */

export type Side = 'dark' | 'light';

export type Piece = {
  side: Side;
  king: boolean;
};

export const BOARD_SIZE = 8;

export function idx(row: number, col: number): number {
  return row * BOARD_SIZE + col;
}

export function rowOf(i: number): number {
  return Math.floor(i / BOARD_SIZE);
}

export function colOf(i: number): number {
  return i % BOARD_SIZE;
}

export function isDarkSquare(i: number): boolean {
  const r = rowOf(i);
  const c = colOf(i);
  return (r + c) % 2 === 1;
}

export function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

/** Direction forward for men: dark moves up (decreasing row), light down. */
export function manForwardDelta(side: Side): number {
  return side === 'dark' ? -1 : 1;
}

export function promotionRow(side: Side): number {
  return side === 'dark' ? 0 : BOARD_SIZE - 1;
}

export function opponent(side: Side): Side {
  return side === 'dark' ? 'light' : 'dark';
}

export function createEmptyBoard(): (Piece | null)[] {
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => null);
}

/** Placement initial standard : 12 pions chacun sur les 3 premières rangées. */
export function setupInitialBoard(): (Piece | null)[] {
  const board = createEmptyBoard();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const i = idx(r, c);
      if (!isDarkSquare(i)) continue;
      if (r <= 2) board[i] = { side: 'light', king: false };
      if (r >= 5) board[i] = { side: 'dark', king: false };
    }
  }
  return board;
}
