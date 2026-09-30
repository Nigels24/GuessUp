/**
 * Pure gameplay logic: drawing a round, building the item sent to the app,
 * hints and judging an answer. No database access, so every rule here is unit
 * tested. All numbers come from common/game-rules.ts.
 */
import { randomInt } from 'node:crypto';
import {
  ANSWER_GRACE_SECONDS,
  LEVELS,
  ROUND_SIZE,
  checkAnswer,
  scoreAnswer,
  type DifficultyKey,
  type QuestionTypeKey,
} from '../common/game-rules.js';

/** Random integer in [0, max). Injected in tests to make shuffles predictable. */
export type RandomInt = (max: number) => number;
const secureRandomInt: RandomInt = (max) => randomInt(max);

/** Fisher–Yates shuffle into a new array (the prototype's shuffle). */
export function shuffle<T>(items: readonly T[], rnd: RandomInt = secureRandomInt): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/* ---------- drawing a round ---------- */

export interface PoolItem {
  id: string;
  difficulty: DifficultyKey;
}

/**
 * The prototype's pickRound: shuffled items of the chosen difficulty first,
 * then, only if there are not enough, shuffled items of the other
 * difficulties, cut to ROUND_SIZE. `pool` must already be the category's
 * active questions.
 */
export function drawRound<T extends PoolItem>(
  pool: readonly T[],
  difficulty: DifficultyKey,
  rnd: RandomInt = secureRandomInt,
): T[] {
  const exact = shuffle(
    pool.filter((q) => q.difficulty === difficulty),
    rnd,
  );
  const rest = shuffle(
    pool.filter((q) => q.difficulty !== difficulty),
    rnd,
  );
  return exact.concat(rest).slice(0, ROUND_SIZE);
}

/* ---------- the item sent to the app (security boundary) ---------- */

/** Stored question fields the server works with. */
export interface GameQuestion {
  id: string;
  type: QuestionTypeKey;
  difficulty: DifficultyKey;
  questionText: string;
  codeSnippet: string | null;
  imageUrl: string | null;
  answer: string;
  alternates: string[];
  choices: string[];
  hint: string | null;
  explanation: string;
}

/**
 * What the app receives for the item being played. It never contains the
 * answer, alternates, explanation or hint: those are revealed only after the
 * student answers (or, for the hint, when they ask for it).
 */
export interface ItemDto {
  /** 1-based position in the round. */
  index: number;
  type: QuestionTypeKey;
  difficulty: DifficultyKey;
  questionText: string;
  codeSnippet: string | null;
  imageUrl: string | null;
  /** MULTIPLE_CHOICE only: the answer and the 3 distractors, shuffled. */
  choices?: string[];
  /** WORD_PUZZLE only: total number of letter slots. */
  answerLength?: number;
  /** WORD_PUZZLE only: letters per word, to draw the slot groups. */
  wordLengths?: number[];
  /** WORD_PUZZLE only: the answer's letters, shuffled. */
  scrambledLetters?: string[];
}

/** Words of a puzzle answer: uppercase, letters and digits only (as in the prototype). */
export function puzzleWords(answer: string): string[] {
  return answer
    .toUpperCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean);
}

/** How many times the prototype re-shuffles to avoid showing the answer unscrambled. */
const MAX_RESHUFFLES = 6;

export function toItemDto(
  question: GameQuestion,
  index: number,
  rnd: RandomInt = secureRandomInt,
): ItemDto {
  // Built field by field on purpose: never spread the question into the DTO.
  const item: ItemDto = {
    index,
    type: question.type,
    difficulty: question.difficulty,
    questionText: question.questionText,
    codeSnippet: question.codeSnippet,
    imageUrl: question.imageUrl,
  };

  if (question.type === 'MULTIPLE_CHOICE') {
    item.choices = shuffle([question.answer, ...question.choices], rnd);
  }

  if (question.type === 'WORD_PUZZLE') {
    const words = puzzleWords(question.answer);
    const letters = words.join('').split('');
    let tiles = shuffle(letters, rnd);
    for (
      let k = 0;
      k < MAX_RESHUFFLES && letters.length > 1 && tiles.join('') === letters.join('');
      k++
    ) {
      tiles = shuffle(letters, rnd);
    }
    item.answerLength = letters.length;
    item.wordLengths = words.map((word) => word.length);
    item.scrambledLetters = tiles;
  }

  return item;
}

/* ---------- hints ---------- */

/** The stored hint, or the prototype's fallback built from the answer. */
export function hintFor(question: Pick<GameQuestion, 'hint' | 'answer'>): string {
  if (question.hint) return question.hint;
  const letters = question.answer.replace(/[^A-Za-z0-9]/g, '');
  return `Starts with "${letters[0] ?? '?'}" and has ${letters.length} characters.`;
}

/* ---------- judging an answer ---------- */

export interface Judgement {
  isCorrect: boolean;
  timedOut: boolean;
  pointsEarned: number;
  /** Whole seconds, at least 1; the full limit on a timeout (as in the prototype). */
  timeTaken: number;
  /** What is stored: an empty string on a timeout or when nothing was sent. */
  submitted: string;
}

/**
 * Judge an answer using the server's clock. `elapsedMs` is measured from when
 * the server sent the item. Beyond the level's limit plus ANSWER_GRACE_SECONDS
 * the item is a timeout: incorrect, 0 points. Within the grace period the
 * answer is judged normally with 0 seconds remaining (no speed bonus).
 */
export function judgeAnswer(input: {
  question: Pick<GameQuestion, 'type' | 'answer' | 'alternates'>;
  difficulty: DifficultyKey;
  submitted: string | undefined;
  elapsedMs: number;
  hintUsed: boolean;
}): Judgement {
  const level = LEVELS[input.difficulty];
  const elapsed = Math.max(0, input.elapsedMs / 1000);

  if (elapsed > level.seconds + ANSWER_GRACE_SECONDS) {
    return {
      isCorrect: false,
      timedOut: true,
      pointsEarned: 0,
      timeTaken: level.seconds,
      submitted: '',
    };
  }

  const remaining = Math.max(0, level.seconds - elapsed);
  const submitted = input.submitted ?? '';
  const isCorrect = checkAnswer(input.question, submitted);
  return {
    isCorrect,
    timedOut: false,
    pointsEarned: scoreAnswer(input.difficulty, isCorrect, remaining, input.hintUsed),
    timeTaken: Math.max(1, Math.round(level.seconds - remaining)),
    submitted,
  };
}
