/**
 * The student's progress summary (GET /me/summary), built from completed
 * rounds only. Pure, so the counting rules are unit tested.
 */
import { BADGES } from '../common/badges.js';
import { accuracyPercent } from '../common/game-rules.js';

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
}

export interface EarnedBadge {
  code: string;
  icon: string;
  name: string;
  earnedAt: Date;
}

export interface MeSummary {
  totalPoints: number;
  roundsPlayed: number;
  badges: EarnedBadge[];
  perCategory: CategoryProgress[];
}

/**
 * `sessions` must be the student's COMPLETED rounds. Every category appears in
 * `perCategory`, in the given order, including those never played. Badge
 * codes no longer defined in BADGES are skipped.
 */
export function buildSummary(
  categories: readonly SummaryCategory[],
  sessions: readonly SummarySession[],
  badgeRows: readonly SummaryBadgeRow[],
): MeSummary {
  const perCategory = categories.map((category) => {
    const played = sessions.filter((s) => s.categoryId === category.id);
    const correct = played.reduce((sum, s) => sum + s.correctCount, 0);
    const answered = played.reduce((sum, s) => sum + s.totalItems, 0);
    return {
      categoryId: category.id,
      name: category.name,
      roundsPlayed: played.length,
      accuracy: accuracyPercent(correct, answered),
      bestScore: played.reduce((best, s) => Math.max(best, s.totalScore), 0),
    };
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
    perCategory,
  };
}
