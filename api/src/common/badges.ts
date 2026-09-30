/**
 * GuessUp achievement badges.
 *
 * Ported from the approved prototype's data section with the same codes,
 * names, icons, descriptions and rules. Badges are evaluated on the server
 * when a round is finished, from the student's completed rounds only.
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
  isCorrect: boolean;
  timeTaken: number;
}

/** What every rule receives (the prototype's `s`). */
export interface BadgeStats {
  sessions: BadgeSession[];
  answers: BadgeAnswer[];
  /** Number of different categories played. */
  categories: number;
}

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
];

/** Build the rule input from a student's completed rounds and their answers. */
export function badgeStats(sessions: BadgeSession[], answers: BadgeAnswer[]): BadgeStats {
  return { sessions, answers, categories: new Set(sessions.map((x) => x.categoryId)).size };
}

/** Badges the student has just earned: rules that pass, minus codes already held. */
export function evaluateBadges(
  stats: BadgeStats,
  alreadyHeld: Iterable<string>,
): BadgeDefinition[] {
  const held = new Set(alreadyHeld);
  return BADGES.filter((badge) => !held.has(badge.code) && badge.rule(stats));
}
