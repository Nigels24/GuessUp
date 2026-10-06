/**
 * Pure part of scripts/badges-backfill.ts (unit tested): which badges it
 * gives and how it groups the accounts in its report.
 */
import { evaluateBadges, type BadgeStats } from '../../src/common/badges.js';
import { isDemoEmail } from '../demo-data/plan.js';

/** The badges added after the prototype; only these are backfilled. */
export const BACKFILL_CODES = ['hot_streak', 'flawless', 'subject_master', 'grand_master'] as const;

export type AccountGroup = 'real' | 'demo' | 'e2e';
export const ACCOUNT_GROUPS: readonly AccountGroup[] = ['real', 'demo', 'e2e'];

/**
 * demo: *@demo.jhcsc.edu.ph (demo:seed); e2e: the test accounts, matched as
 * scripts/cleanup-e2e-data.ts does (contains "e2e-", ends with @example.com).
 */
export function accountGroup(email: string): AccountGroup {
  if (isDemoEmail(email)) return 'demo';
  const lower = email.toLowerCase();
  if (lower.includes('e2e-') && lower.endsWith('@example.com')) return 'e2e';
  return 'real';
}

/** The new badges a student's history earns that they do not hold yet. */
export function backfillFor(stats: BadgeStats, held: readonly string[]): string[] {
  return evaluateBadges(stats, held)
    .map((b) => b.code)
    .filter((code) => (BACKFILL_CODES as readonly string[]).includes(code));
}
