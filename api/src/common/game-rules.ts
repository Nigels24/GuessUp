/**
 * GuessUp game rules.
 *
 * These constants and functions live on the SERVER on purpose. Chapter III
 * states that the game logic and scoring reside in the application layer, so
 * scores cannot be altered by modifying the app installed on the device.
 *
 * Values are taken from the approved prototype (Chapter I, Purpose and
 * Description). Change them here and the whole system follows.
 */

export type DifficultyKey = 'EASY' | 'AVERAGE' | 'DIFFICULT';
export type QuestionTypeKey = 'MULTIPLE_CHOICE' | 'PICTURE' | 'WORD_PUZZLE';

export interface LevelRule {
  /** Seconds allowed per item */
  seconds: number;
  /** Hints allowed per item (0 = no hints) */
  hints: number;
  /** Points deducted when a hint is used */
  hintPenalty: number;
  /** Base points for a correct answer */
  points: number;
}

/** Number of items in one round. */
export const ROUND_SIZE = 5;

/** Answering instantly adds up to this share of the base points. */
export const SPEED_BONUS = 0.5;

export const LEVELS: Record<DifficultyKey, LevelRule> = {
  EASY: { seconds: 60, hints: 1, hintPenalty: 3, points: 10 },
  AVERAGE: { seconds: 45, hints: 1, hintPenalty: 5, points: 20 },
  DIFFICULT: { seconds: 30, hints: 0, hintPenalty: 0, points: 30 },
};

/**
 * Points for one answer.
 * Wrong or unanswered items score 0. Correct items earn the base points of the
 * level, plus a speed bonus proportional to the time left, minus the hint
 * penalty when a hint was used. A correct answer never scores less than 1.
 */
export function scoreAnswer(
  difficulty: DifficultyKey,
  isCorrect: boolean,
  secondsRemaining: number,
  hintUsed: boolean,
): number {
  if (!isCorrect) return 0;
  const level = LEVELS[difficulty];
  const remaining = Math.max(0, Math.min(secondsRemaining, level.seconds));
  const bonus = Math.round((level.points * SPEED_BONUS * remaining) / level.seconds);
  const penalty = hintUsed ? level.hintPenalty : 0;
  return Math.max(1, level.points + bonus - penalty);
}

/** Lowercase and strip everything that is not a letter or a digit. */
export function normalizeAnswer(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export interface AnswerCheckInput {
  type: QuestionTypeKey;
  answer: string;
  alternates?: string[];
}

/**
 * Is the submitted answer correct?
 * Multiple choice compares the chosen option exactly.
 * Picture and word puzzle items are typed by the student, so capitalization,
 * spaces and symbols are ignored ("TCP/IP" === "tcp ip"), and any entry in
 * `alternates` is accepted as well.
 */
export function checkAnswer(
  question: AnswerCheckInput,
  submitted: string | null | undefined,
): boolean {
  if (submitted === null || submitted === undefined || submitted === '') return false;
  if (question.type === 'MULTIPLE_CHOICE') return String(submitted) === question.answer;

  const given = normalizeAnswer(submitted);
  if (!given) return false;
  return [question.answer, ...(question.alternates ?? [])].some(
    (accepted) => normalizeAnswer(accepted) === given,
  );
}

/** Round accuracy as a whole percentage. */
export function accuracyPercent(correct: number, total: number): number {
  if (!total) return 0;
  return Math.round((correct / total) * 100);
}
