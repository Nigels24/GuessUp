import { describe, expect, it } from 'vitest';
import {
  ANSWER_GRACE_SECONDS,
  LEVELS,
  ROUND_SIZE,
  accuracyPercent,
  checkAnswer,
  normalizeAnswer,
  scoreAnswer,
} from './game-rules.js';

describe('game rules constants', () => {
  it('matches the approved prototype', () => {
    expect(ROUND_SIZE).toBe(5);
    expect(ANSWER_GRACE_SECONDS).toBe(2);
    expect(LEVELS.EASY).toEqual({ seconds: 60, hints: 1, hintPenalty: 3, points: 10 });
    expect(LEVELS.AVERAGE).toEqual({ seconds: 45, hints: 1, hintPenalty: 5, points: 20 });
    expect(LEVELS.DIFFICULT).toEqual({ seconds: 30, hints: 0, hintPenalty: 0, points: 30 });
  });
});

describe('scoreAnswer', () => {
  it('gives no points for a wrong answer', () => {
    expect(scoreAnswer('EASY', false, 55, false)).toBe(0);
    expect(scoreAnswer('DIFFICULT', false, 30, false)).toBe(0);
  });

  it('gives base points plus the full speed bonus for an instant answer', () => {
    expect(scoreAnswer('EASY', true, 60, false)).toBe(15); // 10 + 5
    expect(scoreAnswer('DIFFICULT', true, 30, false)).toBe(45); // 30 + 15
  });

  it('gives only the base points when the time is almost gone', () => {
    expect(scoreAnswer('AVERAGE', true, 0, false)).toBe(20);
  });

  it('deducts the hint penalty', () => {
    expect(scoreAnswer('EASY', true, 60, true)).toBe(12); // 10 + 5 - 3
    expect(scoreAnswer('AVERAGE', true, 0, true)).toBe(15); // 20 + 0 - 5
  });

  it('never drops below one point for a correct answer', () => {
    expect(scoreAnswer('EASY', true, 0, true)).toBeGreaterThanOrEqual(1);
  });

  it('ignores a remaining time outside the level limit', () => {
    expect(scoreAnswer('EASY', true, 999, false)).toBe(15);
    expect(scoreAnswer('EASY', true, -5, false)).toBe(10);
  });
});

describe('normalizeAnswer', () => {
  it('drops case, spaces and symbols', () => {
    expect(normalizeAnswer('TCP/IP')).toBe('tcpip');
    expect(normalizeAnswer(' One-to-Many ')).toBe('onetomany');
    expect(normalizeAnswer(null)).toBe('');
  });
});

describe('checkAnswer', () => {
  const mc = { type: 'MULTIPLE_CHOICE' as const, answer: 'Router' };
  const picture = {
    type: 'PICTURE' as const,
    answer: 'One to many',
    alternates: ['1:m', 'one-to-many'],
  };
  const puzzle = { type: 'WORD_PUZZLE' as const, answer: 'BUBBLE SORT' };

  it('compares multiple choice options exactly', () => {
    expect(checkAnswer(mc, 'Router')).toBe(true);
    expect(checkAnswer(mc, 'router')).toBe(false);
    expect(checkAnswer(mc, 'Switch')).toBe(false);
  });

  it('accepts typed answers regardless of case, spaces and symbols', () => {
    expect(checkAnswer(picture, 'one to many')).toBe(true);
    expect(checkAnswer(picture, 'ONE-TO-MANY')).toBe(true);
    expect(checkAnswer(picture, '1:M')).toBe(true);
    expect(checkAnswer(picture, 'many to many')).toBe(false);
  });

  it('accepts a rebuilt word puzzle', () => {
    expect(checkAnswer(puzzle, 'bubble sort')).toBe(true);
    expect(checkAnswer(puzzle, 'BUBBLESORT')).toBe(true);
    expect(checkAnswer(puzzle, 'quick sort')).toBe(false);
  });

  it('treats an empty or missing answer as wrong (timer ran out)', () => {
    expect(checkAnswer(picture, '')).toBe(false);
    expect(checkAnswer(picture, null)).toBe(false);
    expect(checkAnswer(picture, '   ')).toBe(false);
  });
});

describe('accuracyPercent', () => {
  it('rounds to whole percentages', () => {
    expect(accuracyPercent(5, 5)).toBe(100);
    expect(accuracyPercent(3, 5)).toBe(60);
    expect(accuracyPercent(0, 0)).toBe(0);
  });
});
