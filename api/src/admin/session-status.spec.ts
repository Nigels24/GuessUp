import { describe, expect, it } from 'vitest';
import {
  STALE_ROUND_HOURS,
  displayStatus,
  lastActivity,
  staleCutoff,
  statusFilterWhere,
  type RoundActivity,
} from './session-status.js';

const NOW = new Date('2026-10-05T12:00:00Z');
const ago = (minutes: number, ms = 0) => new Date(NOW.getTime() - minutes * 60_000 - ms);
const round = (over: Partial<RoundActivity> = {}): RoundActivity => ({
  status: 'IN_PROGRESS',
  startedAt: ago(300),
  currentServedAt: null,
  answeredAt: [],
  ...over,
});

describe('stale unfinished rounds', () => {
  it('uses a 2-hour cutoff', () => {
    expect(STALE_ROUND_HOURS).toBe(2);
    expect(staleCutoff(NOW)).toEqual(ago(120));
  });

  it('the last activity is the start, an item being sent or an answer, whichever is latest', () => {
    expect(lastActivity(round())).toEqual(ago(300));
    expect(lastActivity(round({ currentServedAt: ago(10) }))).toEqual(ago(10));
    expect(lastActivity(round({ answeredAt: [ago(200), ago(50)], currentServedAt: ago(100) }))).toEqual(ago(50));
  });

  it('shows Abandoned after more than 2 hours without activity, ended at the last activity', () => {
    expect(displayStatus(round({ startedAt: ago(120, 1) }), NOW)).toEqual({ status: 'ABANDONED', staleSince: ago(120, 1) });
    expect(displayStatus(round({ answeredAt: [ago(130)] }), NOW)).toEqual({ status: 'ABANDONED', staleSince: ago(130) });
  });

  it('stays In progress at exactly 2 hours, or with any recent activity', () => {
    expect(displayStatus(round({ startedAt: ago(120) }), NOW).status).toBe('IN_PROGRESS');
    expect(displayStatus(round({ startedAt: ago(5) }), NOW).status).toBe('IN_PROGRESS');
    // Started long ago, but an item was sent or answered recently: still being played.
    expect(displayStatus(round({ currentServedAt: ago(1) }), NOW).status).toBe('IN_PROGRESS');
    expect(displayStatus(round({ answeredAt: [ago(119)] }), NOW).status).toBe('IN_PROGRESS');
  });

  it('never changes a finished round', () => {
    expect(displayStatus(round({ status: 'COMPLETED' }), NOW)).toEqual({ status: 'COMPLETED', staleSince: null });
    expect(displayStatus(round({ status: 'ABANDONED' }), NOW)).toEqual({ status: 'ABANDONED', staleSince: null });
  });

  it('filters by the shown status, with the same cutoff', () => {
    const cutoff = ago(120);
    const stale = {
      status: 'IN_PROGRESS',
      startedAt: { lt: cutoff },
      OR: [{ currentServedAt: null }, { currentServedAt: { lt: cutoff } }],
      answers: { none: { createdAt: { gte: cutoff } } },
    };
    expect(statusFilterWhere('IN_PROGRESS', NOW)).toEqual({ status: 'IN_PROGRESS', NOT: stale });
    expect(statusFilterWhere('ABANDONED', NOW)).toEqual({ OR: [{ status: 'ABANDONED' }, stale] });
    expect(statusFilterWhere('COMPLETED', NOW)).toEqual({ status: 'COMPLETED' });
    expect(statusFilterWhere(undefined, NOW)).toBeUndefined();
  });
});
