/**
 * The student's progress summary (GET /me/summary), built from completed
 * rounds only. Pure, so the counting rules are unit tested.
 */
import { BADGES } from '../common/badges.js';
import { categoryCompletions, levelBests, type CertificateRound } from '../common/certificates.js';
import { accuracyPercent, type DifficultyKey } from '../common/game-rules.js';

export interface SummaryCategory {
  id: string;
  name: string;
}

export interface SummarySession {
  categoryId: string;
  totalScore: number;
  correctCount: number;
  totalItems: number;
}

export interface SummaryBadgeRow {
  badgeCode: string;
  earnedAt: Date;
}

export interface CategoryProgress {
  categoryId: string;
  name: string;
  roundsPlayed: number;
  /** Correct items / items answered across completed rounds, 0–100; 0 when none. */
  accuracy: number;
  /** Highest round score; 0 when no round was completed. */
  bestScore: number;
  /** Best stars (0–3) per level, for the level picker; null when that level was never finished. */
  bestStars: Record<DifficultyKey, number | null>;
}

/** A completed category (every level passed, 2+ stars): the student's certificate. */
export interface SummaryCertificate {
  categoryId: string;
  name: string;
  completedAt: Date;
}

export interface EarnedBadge {
  code: string;
  icon: string;
  name: string;
  earnedAt: Date;
}

/** A badge as the app lists it, earned or not (the prototype's badge grid). */
export interface BadgeInfo {
  code: string;
  icon: string;
  name: string;
  description: string;
}

export interface MeSummary {
  totalPoints: number;
  roundsPlayed: number;
  badges: EarnedBadge[];
  /** Every badge that can be earned, in display order. */
  allBadges: BadgeInfo[];
  perCategory: CategoryProgress[];
  /** Completed categories, earliest first (common/certificates.ts). */
  certificates: SummaryCertificate[];
}

/** Rounds, accuracy, best and average score of the given completed rounds in one category. */
export function categoryStats(categoryId: string, sessions: readonly SummarySession[]) {
  const played = sessions.filter((s) => s.categoryId === categoryId);
  const correct = played.reduce((sum, s) => sum + s.correctCount, 0);
  const answered = played.reduce((sum, s) => sum + s.totalItems, 0);
  const points = played.reduce((sum, s) => sum + s.totalScore, 0);
  return {
    roundsPlayed: played.length,
    accuracy: accuracyPercent(correct, answered),
    bestScore: played.reduce((best, s) => Math.max(best, s.totalScore), 0),
    avgScore: played.length ? Math.round(points / played.length) : 0,
  };
}

/**
 * `sessions` must be the student's COMPLETED rounds. Every category appears in
 * `perCategory`, in the given order, including those never played. Badge
 * codes no longer defined in BADGES are skipped.
 */
export function buildSummary(
  categories: readonly SummaryCategory[],
  sessions: readonly CertificateRound[],
  badgeRows: readonly SummaryBadgeRow[],
): MeSummary {
  const bests = levelBests(sessions);
  const perCategory = categories.map((category) => {
    const { roundsPlayed, accuracy, bestScore } = categoryStats(category.id, sessions);
    const levels = bests.get(category.id) ?? {};
    return {
      categoryId: category.id,
      name: category.name,
      roundsPlayed,
      accuracy,
      bestScore,
      bestStars: {
        EASY: levels.EASY?.stars ?? null,
        AVERAGE: levels.AVERAGE?.stars ?? null,
        DIFFICULT: levels.DIFFICULT?.stars ?? null,
      },
    };
  });
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const certificates = categoryCompletions(sessions).flatMap((c) => {
    const name = names.get(c.categoryId);
    return name ? [{ categoryId: c.categoryId, name, completedAt: c.completedAt }] : [];
  });

  const badges = badgeRows
    .slice()
    .sort((a, b) => a.earnedAt.getTime() - b.earnedAt.getTime())
    .flatMap((row) => {
      const badge = BADGES.find((b) => b.code === row.badgeCode);
      return badge
        ? [{ code: badge.code, icon: badge.icon, name: badge.name, earnedAt: row.earnedAt }]
        : [];
    });

  return {
    totalPoints: sessions.reduce((sum, s) => sum + s.totalScore, 0),
    roundsPlayed: sessions.length,
    badges,
    allBadges: BADGES.map(({ code, icon, name, description }) => ({ code, icon, name, description })),
    perCategory,
    certificates,
  };
}
