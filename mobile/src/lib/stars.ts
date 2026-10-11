/**
 * How the app shows a round's stars. The server decides the number (0–3,
 * api/src/common/stars.ts: 80 % = 3, 60 % = 2, 40 % = 1); these helpers only
 * turn it into filled/empty stars and short labels. Tested by stars.test.mjs
 * (npm test).
 */

export const MAX_STARS = 3;

/**
 * Stars a level needs to count toward the category certificate
 * (api/src/common/certificates.ts PASSING_STARS: 60 %, 3 of 5 correct).
 */
export const PASSING_STARS = 2;

/** Whether every level's best stars pass, i.e. the certificate is earned. */
export function allLevelsPassed(best: Record<string, number | null> | undefined): boolean {
  const levels = Object.values(best ?? {});
  return levels.length > 0 && levels.every((stars) => typeof stars === 'number' && stars >= PASSING_STARS);
}

/** Clamp to 0–3; anything missing or invalid counts as 0. */
function clamp(stars: number | null | undefined): number {
  if (typeof stars !== 'number' || !Number.isFinite(stars)) return 0;
  return Math.max(0, Math.min(MAX_STARS, Math.floor(stars)));
}

/** One entry per star, true = filled: 2 → [true, true, false]. */
export function starSlots(stars: number | null | undefined): boolean[] {
  const filled = clamp(stars);
  return Array.from({ length: MAX_STARS }, (_, i) => i < filled);
}

/** The result screen's line under the stars. */
export function starsLabel(stars: number | null | undefined): string {
  const n = clamp(stars);
  if (n === 0) return 'Try again for a star';
  return n === 1 ? '1 star!' : `${n} stars!`;
}

/** Screen reader text: "2 of 3 stars"; never played: "Not played yet". */
export function starsA11y(stars: number | null | undefined): string {
  if (stars === null || stars === undefined) return 'Not played yet';
  return `${clamp(stars)} of ${MAX_STARS} stars`;
}
