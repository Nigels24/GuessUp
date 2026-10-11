/**
 * Stars for a finished round (panel revision): 0 to 3, from the round's
 * accuracy. One rule for the whole system; the app and the panel only show
 * the number the API sends.
 *
 *   3 stars: 80 % or higher
 *   2 stars: 60 % or higher
 *   1 star:  40 % or higher
 *   0 stars: below 40 %
 *
 * A round with fewer than ROUND_SIZE items (a small category) uses its own
 * accuracy the same way. Abandoned and unfinished rounds get no stars (null).
 */

export const MAX_STARS = 3;

/** Lowest accuracy (percent) for 1, 2 and 3 stars. */
export const STAR_THRESHOLDS = [40, 60, 80] as const;

/** Stars for an accuracy percentage (0–100). */
export function starsForAccuracy(percent: number): number {
  return STAR_THRESHOLDS.filter((min) => percent >= min).length;
}

export interface StarRound {
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  correctCount: number;
  totalItems: number;
}

/**
 * Stars earned by a round, or null when it was not completed. Uses the exact
 * ratio rather than the stored (rounded) accuracy, so 79.5 % is never 3 stars.
 */
export function roundStars(round: StarRound): number | null {
  if (round.status !== 'COMPLETED') return null;
  if (!round.totalItems) return 0;
  return starsForAccuracy((round.correctCount / round.totalItems) * 100);
}
