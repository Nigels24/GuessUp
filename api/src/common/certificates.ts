/**
 * Category completion certificates (panel revision). A student completes a
 * category once they have PASSED each level (Easy, Average and Difficult) in
 * it: at least one finished round at that level with PASSING_STARS or more
 * (2 stars = 60 %, 3 of 5 correct; see stars.ts). Nothing is stored: this is
 * derived from the rounds, so it also covers rounds played before the rule,
 * and a certificate that no longer qualifies simply stops being listed.
 * Pure, unit tested (certificates.spec.ts).
 */
import type { DifficultyKey } from './game-rules.js';
import { roundStars, type StarRound } from './stars.js';

/** The levels a category needs, in display order. */
export const CERTIFICATE_LEVELS: readonly DifficultyKey[] = ['EASY', 'AVERAGE', 'DIFFICULT'];

/** Stars a round needs for its level to count toward the certificate. */
export const PASSING_STARS = 2;

export interface CertificateRound extends StarRound {
  id: string;
  categoryId: string;
  difficulty: DifficultyKey;
  totalScore: number;
  endedAt: Date | null;
}

/** The student's best finished round at one level of a category. */
export interface LevelBest {
  difficulty: DifficultyKey;
  /** Finished rounds at this level. */
  rounds: number;
  correctCount: number;
  totalItems: number;
  totalScore: number;
  stars: number;
}

export interface CategoryCompletion {
  categoryId: string;
  /** When the round that made the last of the three levels pass was finished. */
  completedAt: Date;
  /** That round. */
  completedByRoundId: string;
  /** Best round per level, in CERTIFICATE_LEVELS order. */
  levels: LevelBest[];
}

/** Finished rounds only: completed, with a finish time. */
function finished(rounds: readonly CertificateRound[]) {
  return rounds.filter(
    (r): r is CertificateRound & { endedAt: Date } => r.status === 'COMPLETED' && r.endedAt !== null,
  );
}

/** Whether a round passes its level (PASSING_STARS or more). */
export function passesLevel(round: StarRound): boolean {
  return (roundStars(round) ?? 0) >= PASSING_STARS;
}

/** Better = higher accuracy, then more points, then earlier. */
function better(a: CertificateRound & { endedAt: Date }, b: CertificateRound & { endedAt: Date }) {
  const accA = a.totalItems ? a.correctCount / a.totalItems : 0;
  const accB = b.totalItems ? b.correctCount / b.totalItems : 0;
  if (accA !== accB) return accA > accB;
  if (a.totalScore !== b.totalScore) return a.totalScore > b.totalScore;
  return a.endedAt < b.endedAt;
}

/**
 * Best round per level for each category played: categoryId → level → best.
 * Abandoned and unfinished rounds are left out.
 */
export function levelBests(
  rounds: readonly CertificateRound[],
): Map<string, Partial<Record<DifficultyKey, LevelBest>>> {
  const bestRound = new Map<string, CertificateRound & { endedAt: Date }>();
  const counts = new Map<string, number>();
  for (const round of finished(rounds)) {
    const key = `${round.categoryId}|${round.difficulty}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const current = bestRound.get(key);
    if (!current || better(round, current)) bestRound.set(key, round);
  }
  const result = new Map<string, Partial<Record<DifficultyKey, LevelBest>>>();
  for (const [key, round] of bestRound) {
    const levels = result.get(round.categoryId) ?? {};
    levels[round.difficulty] = {
      difficulty: round.difficulty,
      rounds: counts.get(key)!,
      correctCount: round.correctCount,
      totalItems: round.totalItems,
      totalScore: round.totalScore,
      stars: roundStars(round) ?? 0,
    };
    result.set(round.categoryId, levels);
  }
  return result;
}

/**
 * The categories one student has completed, earliest completion first.
 * `rounds` must all belong to that student.
 */
export function categoryCompletions(rounds: readonly CertificateRound[]): CategoryCompletion[] {
  const done = finished(rounds);
  const passed = done.filter(passesLevel);
  const bests = levelBests(done);
  const completions: CategoryCompletion[] = [];
  for (const [categoryId, levels] of bests) {
    // The first passing round at each level; the latest of those completed the set.
    const firsts = [];
    for (const level of CERTIFICATE_LEVELS) {
      const atLevel = passed.filter((r) => r.categoryId === categoryId && r.difficulty === level);
      if (!atLevel.length) break;
      firsts.push(atLevel.reduce((first, r) => (r.endedAt < first.endedAt ? r : first)));
    }
    if (firsts.length < CERTIFICATE_LEVELS.length) continue;
    const completing = firsts.reduce((last, r) => (r.endedAt > last.endedAt ? r : last));
    completions.push({
      categoryId,
      completedAt: completing.endedAt,
      completedByRoundId: completing.id,
      levels: CERTIFICATE_LEVELS.map((level) => levels[level]!),
    });
  }
  return completions.sort(
    (a, b) => a.completedAt.getTime() - b.completedAt.getTime() || a.categoryId.localeCompare(b.categoryId),
  );
}
