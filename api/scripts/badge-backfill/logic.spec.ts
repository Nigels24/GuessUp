import { describe, expect, it } from 'vitest';
import { badgeStats } from '../../src/common/badges.js';
import { accountGroup, backfillFor } from './logic.js';

describe('badge backfill', () => {
  it('groups accounts as real, demo or e2e', () => {
    expect(accountGroup('juan.delacruz@jhcsc.edu.ph')).toBe('real');
    expect(accountGroup('maria.santos@demo.jhcsc.edu.ph')).toBe('demo');
    expect(accountGroup('e2e-game-a-1759700000000@example.com')).toBe('e2e');
    expect(accountGroup('someone-e2e-x@gmail.com')).toBe('real');
  });

  it('gives only the 4 new badges, and none already held', () => {
    const stats = badgeStats(
      [{ categoryId: 'prog', difficulty: 'DIFFICULT', accuracy: 100, hintsUsed: 0 }],
      [],
      { answerLog: Array.from({ length: 10 }, () => true), activeCategoryIds: ['prog'] },
    );
    // first_round, perfect, no_hint, challenger also pass but were given at round finish.
    expect(backfillFor(stats, [])).toEqual(['hot_streak', 'flawless', 'grand_master']);
    expect(backfillFor(stats, ['flawless'])).toEqual(['hot_streak', 'grand_master']);
    expect(backfillFor(stats, ['hot_streak', 'flawless', 'grand_master'])).toEqual([]);
  });
});
