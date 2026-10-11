import { describe, expect, it } from 'vitest';
import { MAX_STARS, roundStars, starsForAccuracy } from './stars.js';

describe('starsForAccuracy', () => {
  it.each([
    [0, 0],
    [39, 0],
    [39.99, 0],
    [40, 1],
    [59, 1],
    [60, 2],
    [79, 2],
    [79.5, 2],
    [80, 3],
    [100, 3],
  ])('%s %% gives %i stars', (percent, stars) => {
    expect(starsForAccuracy(percent)).toBe(stars);
  });

  it('never gives more than MAX_STARS', () => {
    expect(starsForAccuracy(150)).toBe(MAX_STARS);
  });
});

describe('roundStars', () => {
  const done = (correctCount: number, totalItems = 5) => ({ status: 'COMPLETED' as const, correctCount, totalItems });

  it('maps a 5-item round: 0-1 correct = 0, 2 = 1, 3 = 2, 4-5 = 3', () => {
    expect([0, 1, 2, 3, 4, 5].map((c) => roundStars(done(c)))).toEqual([0, 0, 1, 2, 3, 3]);
  });

  it('uses the exact accuracy of a short round', () => {
    expect(roundStars(done(1, 3))).toBe(0); // 33 %
    expect(roundStars(done(2, 3))).toBe(2); // 67 %
    expect(roundStars(done(3, 3))).toBe(3);
    expect(roundStars(done(1, 2))).toBe(1); // 50 %
    expect(roundStars(done(2, 4))).toBe(1); // 50 %
    expect(roundStars(done(3, 4))).toBe(2); // 75 %
  });

  it('does not round up: 159/200 (79.5 %) is 2 stars', () => {
    expect(roundStars(done(159, 200))).toBe(2);
  });

  it('gives no stars (null) to abandoned and unfinished rounds', () => {
    expect(roundStars({ status: 'ABANDONED', correctCount: 5, totalItems: 5 })).toBeNull();
    expect(roundStars({ status: 'IN_PROGRESS', correctCount: 5, totalItems: 5 })).toBeNull();
  });

  it('gives 0 to a completed round with no items', () => {
    expect(roundStars(done(0, 0))).toBe(0);
  });
});
