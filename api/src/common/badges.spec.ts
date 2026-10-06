import { describe, expect, it } from 'vitest';
import {
  BADGES,
  badgeStats,
  evaluateBadges,
  type BadgeAnswer,
  type BadgeSession,
} from './badges.js';

const round = (overrides: Partial<BadgeSession> = {}): BadgeSession => ({
  categoryId: 'prog',
  difficulty: 'EASY',
  accuracy: 40,
  hintsUsed: 1,
  ...overrides,
});
const answer = (isCorrect: boolean, timeTaken: number, categoryId = 'prog'): BadgeAnswer => ({
  categoryId,
  isCorrect,
  timeTaken,
});
const SEVEN = ['prog', 'dsa', 'dbms', 'net', 'web', 'sad', 'ias'];
const stats = (
  sessions: BadgeSession[],
  answers: BadgeAnswer[] = [],
  answerLog: boolean[] = [],
  activeCategoryIds: string[] = SEVEN,
) => badgeStats(sessions, answers, { answerLog, activeCategoryIds });
const earned = (...args: Parameters<typeof stats>) =>
  evaluateBadges(stats(...args), []).map((b) => b.code);
/** `n` answers in one category, `correct` of them right. */
const answersIn = (categoryId: string, n: number, correct: number) =>
  Array.from({ length: n }, (_, i) => answer(i < correct, 20, categoryId));

describe('badge catalogue', () => {
  it('has the 8 prototype badges with the same codes, in order, then the 4 harder ones', () => {
    expect(BADGES.map((b) => b.code)).toEqual([
      'first_round',
      'perfect',
      'no_hint',
      'speedster',
      'challenger',
      'explorer',
      'dedicated',
      'all_rounder',
      'hot_streak',
      'flawless',
      'subject_master',
      'grand_master',
    ]);
    expect(new Set(BADGES.map((b) => b.code)).size).toBe(12);
    // Each badge is told apart by its icon in the grid and the admin list.
    expect(new Set(BADGES.map((b) => b.icon)).size).toBe(12);
    expect(BADGES.find((b) => b.code === 'hot_streak')?.icon).toBe('🎯');
    expect(BADGES.find((b) => b.code === 'no_hint')).toMatchObject({
      icon: '🧠',
      name: 'No-Hint Hero',
      description: 'Score 80% or higher without using a hint.',
    });
  });

  it('awards nothing before any round is finished', () => {
    expect(earned([])).toEqual([]);
  });
});

describe('badge rules', () => {
  it('first_round: one finished round', () => {
    expect(earned([round()])).toContain('first_round');
  });

  it('perfect: a round at 100% only', () => {
    expect(earned([round({ accuracy: 80 })])).not.toContain('perfect');
    expect(earned([round({ accuracy: 100 })])).toContain('perfect');
  });

  it('no_hint: 80% or more with no hint in that same round', () => {
    expect(earned([round({ accuracy: 80, hintsUsed: 1 })])).not.toContain('no_hint');
    expect(earned([round({ accuracy: 79, hintsUsed: 0 })])).not.toContain('no_hint');
    expect(earned([round({ accuracy: 80, hintsUsed: 0 })])).toContain('no_hint');
  });

  it('speedster: a correct answer within 5 seconds', () => {
    expect(earned([round()], [answer(false, 2), answer(true, 6)])).not.toContain('speedster');
    expect(earned([round()], [answer(true, 5)])).toContain('speedster');
  });

  it('challenger: 60% or more on a Difficult round', () => {
    expect(earned([round({ difficulty: 'AVERAGE', accuracy: 100 })])).not.toContain('challenger');
    expect(earned([round({ difficulty: 'DIFFICULT', accuracy: 59 })])).not.toContain('challenger');
    expect(earned([round({ difficulty: 'DIFFICULT', accuracy: 60 })])).toContain('challenger');
  });

  it('explorer: rounds in 4 different categories', () => {
    const three = ['prog', 'dsa', 'net'].map((categoryId) => round({ categoryId }));
    expect(earned([...three, round({ categoryId: 'prog' })])).not.toContain('explorer');
    expect(earned([...three, round({ categoryId: 'web' })])).toContain('explorer');
  });

  it('dedicated: 10 finished rounds', () => {
    expect(earned(Array.from({ length: 9 }, () => round()))).not.toContain('dedicated');
    expect(earned(Array.from({ length: 10 }, () => round()))).toContain('dedicated');
  });

  it('all_rounder: all 7 categories', () => {
    const six = ['prog', 'dsa', 'dbms', 'net', 'web', 'sad'].map((categoryId) => round({ categoryId }));
    expect(earned(six)).not.toContain('all_rounder');
    expect(earned([...six, round({ categoryId: 'ias' })])).toContain('all_rounder');
  });
});

describe('harder badge rules', () => {
  const T = true;
  const F = false;
  const run = (n: number) => Array.from({ length: n }, () => T);

  it('hot_streak: 10 correct in a row; wrong, "I don\'t know" and timeouts (all stored wrong) break it', () => {
    expect(earned([round()], [], run(9))).not.toContain('hot_streak');
    expect(earned([round()], [], run(10))).toContain('hot_streak');
    expect(earned([round()], [], [...run(5), F, ...run(5)])).not.toContain('hot_streak');
    expect(earned([round()], [], [...run(9), F, ...run(9), F])).not.toContain('hot_streak');
  });

  it('hot_streak: the run continues across rounds and counts anywhere in the history', () => {
    // Rounds of 5: the last 3 of one round, all 5 of the next, the first 2 of a third.
    const log = [F, F, T, T, T, ...run(5), T, T, F, F, F];
    expect(earned([round(), round(), round()], [], log)).toContain('hot_streak');
  });

  it('hot_streak: a correct answer that used a hint is still correct', () => {
    // Hint use does not change isCorrect, so the log only holds right/wrong.
    expect(earned([round({ hintsUsed: 5 })], [], run(10))).toContain('hot_streak');
  });

  it('flawless: 100% on Difficult only', () => {
    expect(earned([round({ difficulty: 'AVERAGE', accuracy: 100 })])).not.toContain('flawless');
    expect(earned([round({ difficulty: 'EASY', accuracy: 100 })])).not.toContain('flawless');
    expect(earned([round({ difficulty: 'DIFFICULT', accuracy: 80 })])).not.toContain('flawless');
    expect(earned([round({ difficulty: 'DIFFICULT', accuracy: 100 })])).toEqual(
      expect.arrayContaining(['flawless', 'perfect']),
    );
  });

  it('subject_master: 5 rounds and exactly 80% in one category counts', () => {
    const five = Array.from({ length: 5 }, () => round({ categoryId: 'dsa' }));
    expect(earned(five, answersIn('dsa', 25, 20))).toContain('subject_master');
  });

  it('subject_master: not with 4 rounds, or just under 80%', () => {
    const four = Array.from({ length: 4 }, () => round({ categoryId: 'dsa' }));
    expect(earned(four, answersIn('dsa', 20, 20))).not.toContain('subject_master');
    const five = Array.from({ length: 5 }, () => round({ categoryId: 'dsa' }));
    expect(earned(five, answersIn('dsa', 25, 19))).not.toContain('subject_master');
  });

  it('subject_master: rounds and accuracy must be in the same category', () => {
    // 5 rounds in dsa at 40%, and 100% over 2 rounds of net.
    const rounds = [...Array.from({ length: 5 }, () => round({ categoryId: 'dsa' })), round({ categoryId: 'net' }), round({ categoryId: 'net' })];
    const answers = [...answersIn('dsa', 25, 10), ...answersIn('net', 10, 10)];
    expect(earned(rounds, answers)).not.toContain('subject_master');
  });

  it('grand_master: a perfect round in every active category', () => {
    const perfectIn = (ids: string[]) => ids.map((categoryId) => round({ categoryId, accuracy: 100 }));
    expect(earned(perfectIn(SEVEN))).toContain('grand_master');
    // One category missing (only played at 80% there).
    const sixPerfect = [...perfectIn(SEVEN.slice(0, 6)), round({ categoryId: 'ias', accuracy: 80 })];
    expect(earned(sixPerfect)).not.toContain('grand_master');
  });

  it('grand_master: follows the playable categories, not a fixed 7', () => {
    const perfectIn = (ids: string[]) => ids.map((categoryId) => round({ categoryId, accuracy: 100 }));
    expect(earned(perfectIn(SEVEN), [], [], [...SEVEN, 'new-subject'])).not.toContain('grand_master');
    expect(earned(perfectIn(SEVEN.slice(0, 5)), [], [], SEVEN.slice(0, 5))).toContain('grand_master');
    expect(earned(perfectIn(SEVEN), [], [], [])).not.toContain('grand_master');
  });
});

describe('evaluateBadges', () => {
  it('skips badges the student already holds', () => {
    const codes = evaluateBadges(stats([round({ accuracy: 100 })]), ['first_round']).map((b) => b.code);
    expect(codes).toEqual(['perfect']);
  });

  it('never awards a held badge twice, new ones included', () => {
    const s = stats(
      [round({ difficulty: 'DIFFICULT', accuracy: 100 })],
      [],
      Array.from({ length: 10 }, () => true),
      ['prog'],
    );
    const first = evaluateBadges(s, []).map((b) => b.code);
    expect(first).toEqual(expect.arrayContaining(['hot_streak', 'flawless', 'grand_master']));
    expect(evaluateBadges(s, first)).toEqual([]);
  });
});
