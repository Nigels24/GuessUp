/**
 * How the Admin Panel shows a round's status. A round left "In progress" with
 * no activity for more than STALE_ROUND_HOURS (the app was closed mid-round)
 * is shown as Abandoned. Decided when the panel reads it: nothing is written,
 * so a round being played is never touched, and the game API still sees the
 * stored status. Pure, unit tested.
 */
import type { Prisma } from '@prisma/client';
import type { SessionStatusKey } from './dto/session.dto.js';

export const STALE_ROUND_HOURS = 2;
const STALE_MS = STALE_ROUND_HOURS * 60 * 60 * 1000;

/** Activity older than this (strictly before) makes an unfinished round stale. */
export function staleCutoff(now: Date): Date {
  return new Date(now.getTime() - STALE_MS);
}

export interface RoundActivity {
  status: SessionStatusKey;
  startedAt: Date;
  /** When the current item was sent (null between items). */
  currentServedAt: Date | null;
  /** When its answers were submitted. */
  answeredAt: Date[];
}

/** The round's latest activity: started, an item sent, or an answer submitted. */
export function lastActivity(round: Omit<RoundActivity, 'status'>): Date {
  return [round.currentServedAt, ...round.answeredAt].reduce<Date>(
    (max, t) => (t && t > max ? t : max),
    round.startedAt,
  );
}

/** The status the panel shows, and when a stale round counts as ended (its last activity). */
export function displayStatus(
  round: RoundActivity,
  now: Date,
): { status: SessionStatusKey; staleSince: Date | null } {
  if (round.status !== 'IN_PROGRESS') return { status: round.status, staleSince: null };
  const last = lastActivity(round);
  return last < staleCutoff(now)
    ? { status: 'ABANDONED', staleSince: last }
    : { status: 'IN_PROGRESS', staleSince: null };
}

/** The same rule as displayStatus, as a database filter: unfinished rounds with no activity since `cutoff`. */
export function staleRoundWhere(cutoff: Date): Prisma.GameSessionWhereInput {
  return {
    status: 'IN_PROGRESS',
    startedAt: { lt: cutoff },
    OR: [{ currentServedAt: null }, { currentServedAt: { lt: cutoff } }],
    answers: { none: { createdAt: { gte: cutoff } } },
  };
}

/** The Game Sessions status filter, matching what the panel shows. */
export function statusFilterWhere(
  status: SessionStatusKey | undefined,
  now: Date,
): Prisma.GameSessionWhereInput | undefined {
  const stale = staleRoundWhere(staleCutoff(now));
  if (status === 'IN_PROGRESS') return { status: 'IN_PROGRESS', NOT: stale };
  if (status === 'ABANDONED') return { OR: [{ status: 'ABANDONED' }, stale] };
  if (status === 'COMPLETED') return { status: 'COMPLETED' };
  return undefined;
}
