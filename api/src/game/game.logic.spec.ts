import { describe, expect, it } from 'vitest';
import {
  ANSWER_GRACE_SECONDS,
  LEVELS,
  ROUND_SIZE,
  scoreAnswer,
  type DifficultyKey,
} from '../common/game-rules.js';
import {
  drawRound,
  hintFor,
  judgeAnswer,
  shuffle,
  toItemDto,
  type GameQuestion,
} from './game.logic.js';

const pool = (counts: Partial<Record<DifficultyKey, number>>) =>
  (Object.entries(counts) as [DifficultyKey, number][]).flatMap(([difficulty, n]) =>
    Array.from({ length: n }, (_, i) => ({ id: `${difficulty}-${i}`, difficulty })),
  );

const question = (overrides: Partial<GameQuestion> = {}): GameQuestion => ({
  id: 'q1',
  type: 'MULTIPLE_CHOICE',
  difficulty: 'EASY',
  questionText: 'Which one is a stack operation?',
  codeSnippet: null,
  imageUrl: null,
  answer: 'Push',
  alternates: ['push op'],
  choices: ['Enqueue', 'Dequeue', 'Peek front'],
  hint: 'Think of plates.',
  explanation: 'Push adds to the top of the stack.',
  ...overrides,
});

describe('shuffle', () => {
  it('keeps every element and does not modify the input', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input);
    expect(out.slice().sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('drawRound', () => {
  it('takes ROUND_SIZE items of the chosen difficulty when there are enough', () => {
    const round = drawRound(pool({ EASY: 7, AVERAGE: 5, DIFFICULT: 5 }), 'EASY');
    expect(round).toHaveLength(ROUND_SIZE);
    expect(round.every((q) => q.difficulty === 'EASY')).toBe(true);
    expect(new Set(round.map((q) => q.id)).size).toBe(ROUND_SIZE);
  });

  it('tops up with other difficulties only after the chosen ones run out', () => {
    const round = drawRound(pool({ EASY: 5, AVERAGE: 2, DIFFICULT: 5 }), 'AVERAGE');
    expect(round).toHaveLength(ROUND_SIZE);
    expect(round.slice(0, 2).every((q) => q.difficulty === 'AVERAGE')).toBe(true);
    expect(round.slice(2).every((q) => q.difficulty !== 'AVERAGE')).toBe(true);
  });

  it('returns fewer items when the category is small, and none when it is empty', () => {
    expect(drawRound(pool({ DIFFICULT: 3 }), 'EASY')).toHaveLength(3);
    expect(drawRound([], 'EASY')).toEqual([]);
  });

  it('shuffles (different orders across draws)', () => {
    const p = pool({ EASY: 5 });
    const orders = new Set(
      Array.from({ length: 30 }, () => drawRound(p, 'EASY').map((q) => q.id).join()),
    );
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe('toItemDto (security boundary)', () => {
  const FORBIDDEN = ['answer', 'alternates', 'explanation', 'hint', 'correctAnswer', 'id'];
  const serializedKeys = (value: unknown): string[] =>
    [...JSON.stringify(value).matchAll(/"([A-Za-z]+)":/g)].map((m) => m[1]!);

  it.each(['MULTIPLE_CHOICE', 'PICTURE', 'WORD_PUZZLE'] as const)(
    'a %s item serializes without answer, alternates, explanation or hint',
    (type) => {
      const item = toItemDto(question({ type, answer: 'BUBBLE SORT' }), 1);
      const keys = serializedKeys(item);
      for (const key of FORBIDDEN) expect(keys).not.toContain(key);
      expect(JSON.stringify(item)).not.toContain('Push adds to the top');
      expect(JSON.stringify(item)).not.toContain('Think of plates');
    },
  );

  it('multiple choice: the answer and the 3 distractors, shuffled on the server', () => {
    const item = toItemDto(question(), 2);
    expect(item.index).toBe(2);
    expect(item.choices?.slice().sort()).toEqual(['Dequeue', 'Enqueue', 'Peek front', 'Push']);
    expect(item).not.toHaveProperty('scrambledLetters');
  });

  it('word puzzle: slot counts per word and the letters scrambled', () => {
    const item = toItemDto(question({ type: 'WORD_PUZZLE', answer: 'Bubble sort', choices: [] }), 1);
    expect(item.answerLength).toBe(10);
    expect(item.wordLengths).toEqual([6, 4]);
    expect(item.scrambledLetters?.slice().sort()).toEqual('BUBBLESORT'.split('').sort());
    expect(item.scrambledLetters?.join('')).not.toBe('BUBBLESORT');
    expect(item).not.toHaveProperty('choices');
  });

  it('picture: no choices and no puzzle fields', () => {
    const item = toItemDto(question({ type: 'PICTURE', imageUrl: '/static/images/stack.svg' }), 1);
    expect(item.imageUrl).toBe('/static/images/stack.svg');
    expect(item).not.toHaveProperty('choices');
    expect(item).not.toHaveProperty('answerLength');
  });
});

describe('hintFor', () => {
  it('uses the stored hint', () => {
    expect(hintFor({ hint: 'Think of plates.', answer: 'Push' })).toBe('Think of plates.');
  });

  it("falls back to the prototype's first letter and length", () => {
    expect(hintFor({ hint: null, answer: 'TCP/IP' })).toBe('Starts with "T" and has 5 characters.');
  });
});

describe('judgeAnswer (server clock)', () => {
  const easy = LEVELS.EASY;

  it('scores a correct answer with scoreAnswer and the server-side time left', () => {
    const j = judgeAnswer({
      question: question(),
      difficulty: 'EASY',
      submitted: 'Push',
      elapsedMs: 10_000,
      hintUsed: true,
    });
    expect(j).toMatchObject({ isCorrect: true, timedOut: false, timeTaken: 10, submitted: 'Push' });
    expect(j.pointsEarned).toBe(scoreAnswer('EASY', true, easy.seconds - 10, true));
  });

  it('a wrong answer scores 0', () => {
    const j = judgeAnswer({
      question: question(),
      difficulty: 'EASY',
      submitted: 'Enqueue',
      elapsedMs: 3_000,
      hintUsed: false,
    });
    expect(j).toMatchObject({ isCorrect: false, pointsEarned: 0 });
  });

  it('after the limit plus the grace period it is a timeout: incorrect, 0 points, empty answer', () => {
    const j = judgeAnswer({
      question: question(),
      difficulty: 'EASY',
      submitted: 'Push',
      elapsedMs: (easy.seconds + ANSWER_GRACE_SECONDS) * 1000 + 1,
      hintUsed: false,
    });
    expect(j).toEqual({
      isCorrect: false,
      timedOut: true,
      pointsEarned: 0,
      timeTaken: easy.seconds,
      submitted: '',
    });
  });

  it('inside the grace period a correct answer still counts, without a speed bonus', () => {
    const j = judgeAnswer({
      question: question(),
      difficulty: 'EASY',
      submitted: 'Push',
      elapsedMs: (easy.seconds + ANSWER_GRACE_SECONDS) * 1000 - 1,
      hintUsed: false,
    });
    expect(j).toMatchObject({ isCorrect: true, timedOut: false, timeTaken: easy.seconds });
    expect(j.pointsEarned).toBe(easy.points);
  });

  it('typed answers accept alternates and ignore case and symbols', () => {
    const j = judgeAnswer({
      question: question({ type: 'PICTURE' }),
      difficulty: 'AVERAGE',
      submitted: 'PUSH-OP',
      elapsedMs: 1_000,
      hintUsed: false,
    });
    expect(j.isCorrect).toBe(true);
  });

  it('no answer sent is incorrect and stored as an empty string', () => {
    const j = judgeAnswer({
      question: question(),
      difficulty: 'DIFFICULT',
      submitted: undefined,
      elapsedMs: 1_000,
      hintUsed: false,
    });
    expect(j).toMatchObject({ isCorrect: false, pointsEarned: 0, submitted: '' });
  });
});
