/**
 * Géométrie du plateau Ludo (parcours standard 52 cases + couloirs).
 *
 * Positions token :
 * - yard: chez soi (index 0..3)
 * - track: case absolue 0..51 sur l’anneau
 * - home: couloir 0..5 (5 = arrivée)
 */

export type LudoColor = 'red' | 'green' | 'yellow' | 'blue';

export const COLORS_BY_SEAT: LudoColor[] = ['red', 'green', 'yellow', 'blue'];

/** Case d’entrée sur l’anneau pour chaque couleur */
export const ENTRY_INDEX: Record<LudoColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

/** Case avant le couloir (dernière case publique) */
export const PRE_HOME_INDEX: Record<LudoColor, number> = {
  red: 50,
  green: 11,
  yellow: 24,
  blue: 37,
};

/** Cases sûres (étoiles) — pas de capture */
export const SAFE_SQUARES = new Set<number>([0, 8, 13, 21, 26, 34, 39, 47]);

export const TRACK_SIZE = 52;
export const HOME_STRETCH = 6; // indices 0..5, 5 = finish
export const TOKENS_PER_PLAYER = 4;

export type TokenPos =
  | { kind: 'yard'; slot: number }
  | { kind: 'track'; index: number }
  | { kind: 'home'; index: number };

export function isSafeTrack(index: number): boolean {
  return SAFE_SQUARES.has(index);
}

/** Distance depuis l’entrée jusqu’à pre-home inclusive = 51 cases de parcours */
export function trackDistanceFromEntry(color: LudoColor, trackIndex: number): number {
  const entry = ENTRY_INDEX[color];
  return (trackIndex - entry + TRACK_SIZE) % TRACK_SIZE;
}
