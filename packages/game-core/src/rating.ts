/**
 * ELO classique (K-factor configurable).
 * Utilisé pour chess ranking et tout jeu ranked.
 */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

export function eloUpdate(
  rating: number,
  opponentRating: number,
  score: 0 | 0.5 | 1,
  k = 32,
): { next: number; delta: number } {
  const exp = expectedScore(rating, opponentRating);
  const delta = Math.round(k * (score - exp));
  return { next: rating + delta, delta };
}

export function multiplayerElo(
  ratings: number[],
  winnerIndex: number | null,
  k = 24,
): number[] {
  if (winnerIndex === null) {
    // Draw: everyone gets 0.5 vs average of others
    return ratings.map((r, i) => {
      const others = ratings.filter((_, j) => j !== i);
      const avg = others.reduce((a, b) => a + b, 0) / Math.max(others.length, 1);
      return eloUpdate(r, avg, 0.5, k).next;
    });
  }
  return ratings.map((r, i) => {
    const others = ratings.filter((_, j) => j !== i);
    const avg = others.reduce((a, b) => a + b, 0) / Math.max(others.length, 1);
    const score: 0 | 1 = i === winnerIndex ? 1 : 0;
    return eloUpdate(r, avg, score, k).next;
  });
}
