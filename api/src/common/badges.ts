/**
 * GuessUp achievement badges.
 *
 * The first 8 are ported from the approved prototype's data section with the
 * same codes, names, icons, descriptions and rules; the last 4 are harder ones
 * added after testing. Badges are evaluated on the server when a round is
 * finished, from the student's completed rounds (Hot Streak alone reads every
 * answer, see BadgeStats.answerLog). The list runs from easiest to hardest and
 * is the order of the app's badge grid.
 */
import type { DifficultyKey } from './game-rules.js';

/** One finished round, as the badge rules see it. */
export interface BadgeSession {
  categoryId: string;
  difficulty: DifficultyKey;
  accuracy: number;
  hintsUsed: number;
}

/** One answer from a finished round. */
export interface BadgeAnswer {
  categoryId: string;
  isCorrect: boolean;
  timeTaken: number;
}

/** What every rule receives (the prototype's `s`). */
export interface BadgeStats {
  sessions: BadgeSession[];
  answers: BadgeAnswer[];
  /** Number of different categories played. */
  categories: number;
  /**
   * isCorrect of every answer the student has given, oldest first, in
   * abandoned rounds too: quitting a round must not hide the wrong answer that
   * ended a streak. "I don't know" and timeouts are stored as wrong answers.
   */
  answerLog: boolean[];
  /** Categories the student can play now (at least one active question). */
  activeCategoryIds: string[];
}

/** Hot Streak: correct answers in a row. */
export const STREAK_LENGTH = 10;
/** Subject Master: finished rounds in one category, and accuracy (%) over its answers. */
export const MASTER_ROUNDS = 5;
export const MASTER_ACCURACY = 80;

export interface BadgeDefinition {
  code: string;
  icon: string;
  name: string;
  description: string;
  rule: (stats: BadgeStats) => boolean;
}

export const BADGES: readonly BadgeDefinition[] = [
  {
    code: 'first_round',
    icon: '🎉',
    name: 'First Steps',
    description: 'Finish your first round.',
    rule: (s) => s.sessions.length >= 1,
  },
  {
    code: 'perfect',
    icon: '💯',
    name: 'Perfect Round',
    description: 'Answer every item in a round correctly.',
    rule: (s) => s.sessions.some((x) => x.accuracy === 100),
  },
  {
    code: 'no_hint',
    icon: '🧠',
    name: 'No-Hint Hero',
    description: 'Score 80% or higher without using a hint.',
    rule: (s) => s.sessions.some((x) => x.hintsUsed === 0 && x.accuracy >= 80),
  },
  {
    code: 'speedster',
    icon: '⚡',
    name: 'Speedster',
    description: 'Answer an item correctly within 5 seconds.',
    rule: (s) => s.answers.some((a) => a.isCorrect && a.timeTaken <= 5),
  },
  {
    code: 'challenger',
    icon: '🔥',
    name: 'Challenger',
    description: 'Score 60% or higher on a Difficult round.',
    rule: (s) => s.sessions.some((x) => x.difficulty === 'DIFFICULT' && x.accuracy >= 60),
  },
  {
    code: 'explorer',
    icon: '🧭',
    name: 'Explorer',
    description: 'Play rounds in 4 different categories.',
    rule: (s) => s.categories >= 4,
  },
  {
    code: 'dedicated',
    icon: '📚',
    name: 'Dedicated',
    description: 'Finish 10 rounds.',
    rule: (s) => s.sessions.length >= 10,
  },
  {
    code: 'all_rounder',
    icon: '🏆',
    name: 'All-Rounder',
    description: 'Play all 7 subject categories.',
    rule: (s) => s.categories >= 7,
  },
  {
    code: 'hot_streak',
    icon: '🎯',
    name: 'Hot Streak',
    description: 'Answer 10 items correctly in a row.',
    rule: (s) => longestRun(s.answerLog) >= STREAK_LENGTH,
  },
  {
    code: 'flawless',
    icon: '💎',
    name: 'Flawless',
    description: 'Answer every item correctly in a Difficult round.',
    rule: (s) => s.sessions.some((x) => x.difficulty === 'DIFFICULT' && x.accuracy === 100),
  },
  {
    code: 'subject_master',
    icon: '🎓',
    name: 'Subject Master',
    description: 'Finish 5 rounds in one category with 80% accuracy or higher.',
    rule: (s) => isSubjectMaster(s),
  },
  {
    code: 'grand_master',
    icon: '👑',
    name: 'Grand Master',
    description: 'Get a perfect round in every category.',
    rule: (s) =>
      s.activeCategoryIds.length > 0 &&
      s.activeCategoryIds.every((id) =>
        s.sessions.some((x) => x.categoryId === id && x.accuracy === 100),
      ),
  },
];

/** The longest run of `true` in the list. */
function longestRun(log: readonly boolean[]): number {
  let best = 0;
  let run = 0;
  for (const correct of log) {
    run = correct ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** A category with MASTER_ROUNDS finished rounds and MASTER_ACCURACY % over all its answers. */
function isSubjectMaster(s: BadgeStats): boolean {
  const rounds = new Map<string, number>();
  for (const x of s.sessions) rounds.set(x.categoryId, (rounds.get(x.categoryId) ?? 0) + 1);
  const tally = new Map<string, { correct: number; total: number }>();
  for (const a of s.answers) {
    const t = tally.get(a.categoryId) ?? { correct: 0, total: 0 };
    t.total += 1;
    if (a.isCorrect) t.correct += 1;
    tally.set(a.categoryId, t);
  }
  return [...rounds].some(([categoryId, count]) => {
    const t = tally.get(categoryId);
    // Whole numbers, so exactly 80% counts.
    return count >= MASTER_ROUNDS && !!t && t.correct * 100 >= MASTER_ACCURACY * t.total;
  });
}

/**
 * Build the rule input from a student's completed rounds and their answers,
 * every answer they gave (for Hot Streak) and the playable categories.
 */
export function badgeStats(
  sessions: BadgeSession[],
  answers: BadgeAnswer[],
  more: Pick<BadgeStats, 'answerLog' | 'activeCategoryIds'>,
): BadgeStats {
  return {
    sessions,
    answers,
    categories: new Set(sessions.map((x) => x.categoryId)).size,
    answerLog: more.answerLog,
    activeCategoryIds: more.activeCategoryIds,
  };
}

/** Badges the student has just earned: rules that pass, minus codes already held. */
export function evaluateBadges(
  stats: BadgeStats,
  alreadyHeld: Iterable<string>,
): BadgeDefinition[] {
  const held = new Set(alreadyHeld);
  return BADGES.filter((badge) => !held.has(badge.code) && badge.rule(stats));
}
