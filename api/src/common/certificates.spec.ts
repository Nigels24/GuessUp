import { describe, expect, it } from 'vitest';
import { categoryCompletions, levelBests, passesLevel, type CertificateRound } from './certificates.js';

let next = 0;
const day = (d: number, h = 0) => new Date(Date.UTC(2026, 9, d, h));
function round(over: Partial<CertificateRound>): CertificateRound {
  return {
    id: `r${++next}`,
    categoryId: 'net',
    difficulty: 'EASY',
    status: 'COMPLETED',
    correctCount: 3,
    totalItems: 5,
    totalScore: 40,
    endedAt: day(1),
    ...over,
  };
}

describe('categoryCompletions', () => {
  it('2 of 3 levels is not a completion', () => {
    const rounds = [round({ difficulty: 'EASY' }), round({ difficulty: 'AVERAGE' })];
    expect(categoryCompletions(rounds)).toEqual([]);
  });

  it('a level passes at 3 of 5 (2 stars), not at 2 of 5 (1 star)', () => {
    expect(passesLevel(round({ correctCount: 2 }))).toBe(false);
    expect(passesLevel(round({ correctCount: 3 }))).toBe(true);
    expect(passesLevel(round({ correctCount: 5, status: 'ABANDONED' }))).toBe(false);
  });

  it('all 3 levels passing is a completion dated by the round that made the last level pass', () => {
    const last = round({ difficulty: 'DIFFICULT', correctCount: 3, totalScore: 30, endedAt: day(5) });
    const rounds = [
      round({ difficulty: 'EASY', endedAt: day(1) }),
      round({ difficulty: 'AVERAGE', correctCount: 4, endedAt: day(3) }),
      last,
      // A later replay of Easy does not move the completion date.
      round({ difficulty: 'EASY', endedAt: day(9), correctCount: 5, totalScore: 70 }),
    ];
    const [completion, ...rest] = categoryCompletions(rounds);
    expect(rest).toEqual([]);
    expect(completion!.categoryId).toBe('net');
    expect(completion!.completedAt).toEqual(day(5));
    expect(completion!.completedByRoundId).toBe(last.id);
    expect(completion!.levels.map((l) => [l.difficulty, l.correctCount, l.stars, l.rounds])).toEqual([
      ['EASY', 5, 3, 2],
      ['AVERAGE', 4, 3, 1],
      ['DIFFICULT', 3, 2, 1],
    ]);
  });

  it('one level only at 1 star is not a completion', () => {
    const rounds = [
      round({ difficulty: 'EASY', correctCount: 5 }),
      round({ difficulty: 'AVERAGE', correctCount: 5 }),
      round({ difficulty: 'DIFFICULT', correctCount: 2 }),
      round({ difficulty: 'DIFFICULT', correctCount: 0 }),
    ];
    expect(categoryCompletions(rounds)).toEqual([]);
  });

  it('0 of 5 on every level is not a completion', () => {
    const rounds = (['EASY', 'AVERAGE', 'DIFFICULT'] as const).map((difficulty) =>
      round({ difficulty, correctCount: 0, totalScore: 0 }),
    );
    expect(categoryCompletions(rounds)).toEqual([]);
  });

  it('is dated by the round that made the last level pass, not the first finished round there', () => {
    const passing = round({ difficulty: 'DIFFICULT', correctCount: 3, endedAt: day(7) });
    const rounds = [
      round({ difficulty: 'EASY', endedAt: day(1) }),
      round({ difficulty: 'AVERAGE', endedAt: day(1) }),
      round({ difficulty: 'DIFFICULT', correctCount: 1, endedAt: day(2) }),
      round({ difficulty: 'DIFFICULT', correctCount: 2, endedAt: day(4) }),
      passing,
      round({ difficulty: 'DIFFICULT', correctCount: 5, endedAt: day(9) }),
    ];
    const [completion] = categoryCompletions(rounds);
    expect(completion!.completedAt).toEqual(day(7));
    expect(completion!.completedByRoundId).toBe(passing.id);
    // The certificate line is still the best round at that level.
    expect(completion!.levels[2]).toMatchObject({ correctCount: 5, stars: 3, rounds: 4 });
  });

  it('ignores abandoned and unfinished rounds', () => {
    const rounds = [
      round({ difficulty: 'EASY' }),
      round({ difficulty: 'AVERAGE' }),
      round({ difficulty: 'DIFFICULT', status: 'ABANDONED', endedAt: day(2) }),
      round({ difficulty: 'DIFFICULT', status: 'IN_PROGRESS', endedAt: null }),
    ];
    expect(categoryCompletions(rounds)).toEqual([]);
  });

  it('counts per category: levels in different categories do not combine', () => {
    const rounds = [
      round({ categoryId: 'net', difficulty: 'EASY' }),
      round({ categoryId: 'net', difficulty: 'AVERAGE' }),
      round({ categoryId: 'db', difficulty: 'DIFFICULT' }),
      round({ categoryId: 'db', difficulty: 'EASY', endedAt: day(2) }),
      round({ categoryId: 'db', difficulty: 'AVERAGE', endedAt: day(2) }),
    ];
    expect(categoryCompletions(rounds).map((c) => c.categoryId)).toEqual(['db']);
  });

  it('lists several completions, earliest first', () => {
    const set = (categoryId: string, d: number) =>
      (['EASY', 'AVERAGE', 'DIFFICULT'] as const).map((difficulty) => round({ categoryId, difficulty, endedAt: day(d) }));
    expect(categoryCompletions([...set('sys', 7), ...set('net', 3)]).map((c) => c.categoryId)).toEqual(['net', 'sys']);
  });
});

describe('levelBests', () => {
  it('picks the most accurate round, then the higher score', () => {
    const bests = levelBests([
      round({ difficulty: 'EASY', correctCount: 4, totalScore: 50 }),
      round({ difficulty: 'EASY', correctCount: 4, totalScore: 55 }),
      round({ difficulty: 'EASY', correctCount: 2, totalScore: 90 }),
    ]);
    expect(bests.get('net')!.EASY).toEqual({
      difficulty: 'EASY',
      rounds: 3,
      correctCount: 4,
      totalItems: 5,
      totalScore: 55,
      stars: 3,
    });
    expect(bests.get('net')!.AVERAGE).toBeUndefined();
  });

  it('leaves out abandoned rounds', () => {
    expect(levelBests([round({ status: 'ABANDONED', endedAt: day(1) })]).size).toBe(0);
  });
});
