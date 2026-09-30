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
const answer = (isCorrect: boolean, timeTaken: number): BadgeAnswer => ({ isCorrect, timeTaken });
const earned = (sessions: BadgeSession[], answers: BadgeAnswer[] = []) =>
  evaluateBadges(badgeStats(sessions, answers), []).map((b) => b.code);

describe('badge catalogue', () => {
  it('has the 8 prototype badges with the same codes, in order', () => {
    expect(BADGES.map((b) => b.code)).toEqual([
      'first_round',
      'perfect',
      'no_hint',
      'speedster',
      'challenger',
      'explorer',
      'dedicated',
      'all_rounder',
    ]);
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

describe('evaluateBadges', () => {
  it('skips badges the student already holds', () => {
    const stats = badgeStats([round({ accuracy: 100 })], []);
    const codes = evaluateBadges(stats, ['first_round']).map((b) => b.code);
    expect(codes).toEqual(['perfect']);
  });
});
