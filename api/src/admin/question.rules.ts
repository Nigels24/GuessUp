/**
 * Rules for question items saved from the Admin Panel. Pure (no database), so
 * every rule is unit tested. The point is that an administrator cannot save an
 * item the game cannot play: the three item types are checked the way the
 * prototype's question form checks them, and hints follow LEVELS in
 * common/game-rules.ts (Difficult has none).
 */
import { LEVELS, normalizeAnswer, type DifficultyKey, type QuestionTypeKey } from '../common/game-rules.js';
import { isInFolder } from '../common/cloudinary-folders.js';
import { puzzleWords } from '../game/game.logic.js';

export const QUESTION_LIMITS = {
  questionText: 300,
  codeSnippet: 1000,
  answer: 80,
  hint: 200,
  explanation: 500,
  topic: 40,
  imageUrl: 500,
  /** Multiple choice: the answer plus exactly this many wrong options (the app shows A–D). */
  distractors: 3,
  choice: 80,
  /** Typed items (picture, word puzzle): other accepted spellings. */
  maxAlternates: 5,
  alternate: 80,
  /** Word puzzle letter tiles, as in the prototype ("16 letters or fewer"). */
  puzzleMinLetters: 2,
  puzzleMaxLetters: 16,
} as const;

export const QUESTION_MESSAGES = {
  questionRequired: 'Enter the question or clue.',
  answerRequired: 'Enter the correct answer.',
  explanationRequired: 'Add a short explanation. Students see it after every item.',
  answerNeedsLetter: 'The answer needs at least one letter or digit.',
  noHintOnDifficult: 'Difficult items have no hints. Leave the hint empty.',
  mcNeedsDistractors: `Multiple-choice items need ${QUESTION_LIMITS.distractors} wrong options.`,
  mcOptionsUnique: `The ${QUESTION_LIMITS.distractors + 1} options must all be different.`,
  pictureNeedsImage: 'Upload an image for picture items.',
  badImageUrl: 'The image address is not valid. Upload the image again.',
  badImagePublicId: 'The image id is not valid. Upload the image again.',
  puzzleLettersOnly: 'Word puzzle answers may only contain letters and spaces.',
  puzzleLength: `Word puzzle answers must be ${QUESTION_LIMITS.puzzleMinLetters} to ${QUESTION_LIMITS.puzzleMaxLetters} letters long.`,
  tooManyAlternates: `List at most ${QUESTION_LIMITS.maxAlternates} other accepted answers.`,
  alternateNeedsLetter: 'Each accepted answer needs at least one letter or digit.',
} as const;

/** A question as the form sends it (before normalizing). */
export interface QuestionInput {
  categoryId: string;
  type: QuestionTypeKey;
  difficulty: DifficultyKey;
  questionText: string;
  codeSnippet?: string | null;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  answer: string;
  alternates?: string[];
  choices?: string[];
  hint?: string | null;
  explanation: string;
  topic?: string | null;
  isActive?: boolean;
}

/** What is stored: trimmed, with the fields that do not apply to the type cleared. */
export interface QuestionData {
  categoryId: string;
  type: QuestionTypeKey;
  difficulty: DifficultyKey;
  questionText: string;
  codeSnippet: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  answer: string;
  alternates: string[];
  choices: string[];
  hint: string | null;
  explanation: string;
  topic: string | null;
  isActive: boolean;
}

const text = (value: string | null | undefined): string => (value ?? '').trim();
const optional = (value: string | null | undefined): string | null => text(value) || null;

/** Code keeps its indentation; only trailing blank space is removed (as in the prototype). */
const code = (value: string | null | undefined): string | null =>
  (value ?? '').replace(/\s+$/, '').replace(/^\s*\n/, '') || null;

/** Seeded pictures are served by the API (/static/images/...); uploads are https URLs. */
export function isAllowedImageUrl(url: string): boolean {
  if (/^\/static\/images\/[\w.-]+$/.test(url)) return true;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Only question images inside the GuessUp folder (common/cloudinary-folders.ts) are accepted. */
export function isAllowedPublicId(publicId: string): boolean {
  return isInFolder(publicId, 'questions');
}

/** Letters and single spaces only, e.g. "LINKED LIST". */
const PUZZLE_ANSWER = /^[A-Za-z]+(?: [A-Za-z]+)*$/;

/**
 * Normalizes a question and lists every rule it breaks (empty when it can be
 * saved). Messages are the ones the Admin Panel shows.
 */
export function checkQuestion(input: QuestionInput): { data: QuestionData; errors: string[] } {
  const errors: string[] = [];
  const type = input.type;
  const isTyped = type !== 'MULTIPLE_CHOICE';

  let answer = text(input.answer);
  if (type === 'WORD_PUZZLE') answer = answer.replace(/\s+/g, ' ');

  const data: QuestionData = {
    categoryId: input.categoryId,
    type,
    difficulty: input.difficulty,
    questionText: text(input.questionText),
    codeSnippet: code(input.codeSnippet),
    imageUrl: type === 'PICTURE' ? optional(input.imageUrl) : null,
    imagePublicId: type === 'PICTURE' ? optional(input.imagePublicId) : null,
    answer,
    alternates: isTyped ? uniqueTrimmed(input.alternates ?? []) : [],
    choices: isTyped ? [] : (input.choices ?? []).map(text),
    hint: optional(input.hint),
    explanation: text(input.explanation),
    topic: optional(input.topic),
    isActive: input.isActive ?? true,
  };

  if (!data.questionText) errors.push(QUESTION_MESSAGES.questionRequired);
  if (!data.answer) errors.push(QUESTION_MESSAGES.answerRequired);
  else if (!normalizeAnswer(data.answer)) errors.push(QUESTION_MESSAGES.answerNeedsLetter);
  if (!data.explanation) errors.push(QUESTION_MESSAGES.explanationRequired);
  if (data.hint && LEVELS[data.difficulty].hints === 0) {
    errors.push(QUESTION_MESSAGES.noHintOnDifficult);
  }

  if (type === 'MULTIPLE_CHOICE') {
    if (data.choices.length !== QUESTION_LIMITS.distractors || data.choices.some((c) => !c)) {
      errors.push(QUESTION_MESSAGES.mcNeedsDistractors);
    } else if (data.answer) {
      const options = [data.answer, ...data.choices].map((o) => o.toLowerCase());
      if (new Set(options).size !== options.length) errors.push(QUESTION_MESSAGES.mcOptionsUnique);
    }
  }

  if (type === 'PICTURE') {
    if (!data.imageUrl) errors.push(QUESTION_MESSAGES.pictureNeedsImage);
    else if (!isAllowedImageUrl(data.imageUrl)) errors.push(QUESTION_MESSAGES.badImageUrl);
    if (data.imagePublicId && !isAllowedPublicId(data.imagePublicId)) {
      errors.push(QUESTION_MESSAGES.badImagePublicId);
    }
  }

  if (type === 'WORD_PUZZLE' && data.answer) {
    if (!PUZZLE_ANSWER.test(data.answer)) {
      errors.push(QUESTION_MESSAGES.puzzleLettersOnly);
    } else {
      const letters = puzzleWords(data.answer).join('').length;
      if (letters < QUESTION_LIMITS.puzzleMinLetters || letters > QUESTION_LIMITS.puzzleMaxLetters) {
        errors.push(QUESTION_MESSAGES.puzzleLength);
      }
    }
  }

  if (isTyped) {
    if (data.alternates.length > QUESTION_LIMITS.maxAlternates) {
      errors.push(QUESTION_MESSAGES.tooManyAlternates);
    }
    if (data.alternates.some((a) => !normalizeAnswer(a))) {
      errors.push(QUESTION_MESSAGES.alternateNeedsLetter);
    }
  }

  return { data, errors };
}

/** Trimmed, blanks dropped, duplicates (ignoring case) removed, order kept. */
function uniqueTrimmed(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values.map((v) => v.trim()).filter(Boolean)) {
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(value);
    }
  }
  return out;
}
