/**
 * Gameplay API calls and the types they return. The shapes mirror the API's
 * DTOs (api/src/game/game.types.ts, api/src/me/me.summary.ts,
 * api/src/categories/categories.service.ts); keep them in step.
 */
import { api } from './api';

export type Difficulty = 'EASY' | 'AVERAGE' | 'DIFFICULT';
export type QuestionType = 'MULTIPLE_CHOICE' | 'PICTURE' | 'WORD_PUZZLE';

/* ---------- display rules (from the prototype; the server enforces them) ---------- */

/** Items in one round (ROUND_SIZE in api/src/common/game-rules.ts). */
export const ROUND_SIZE = 5;

/** Number of badges a student can earn (BADGES in api/src/common/badges.ts). */
export const TOTAL_BADGES = 8;

export interface LevelInfo {
  key: Difficulty;
  label: string;
  icon: string;
  desc: string;
  color: string;
  seconds: number;
  hints: number;
  hintPenalty: number;
  points: number;
}

/** The prototype's levels, in the order the level picker shows them. */
export const LEVELS: readonly LevelInfo[] = [
  {
    key: 'EASY',
    label: 'Easy',
    icon: '🌱',
    desc: 'Definition recall and identification',
    color: '#22C55E',
    seconds: 60,
    hints: 1,
    hintPenalty: 3,
    points: 10,
  },
  {
    key: 'AVERAGE',
    label: 'Average',
    icon: '⚡',
    desc: 'Interpret a scenario, diagram, or short code',
    color: '#F59E0B',
    seconds: 45,
    hints: 1,
    hintPenalty: 5,
    points: 20,
  },
  {
    key: 'DIFFICULT',
    label: 'Difficult',
    icon: '🔥',
    desc: 'Trace logic, evaluate output, compare concepts',
    color: '#EF4444',
    seconds: 30,
    hints: 0,
    hintPenalty: 0,
    points: 30,
  },
];

export function levelInfo(key: Difficulty): LevelInfo {
  return LEVELS.find((l) => l.key === key)!;
}

/* ---------- response types ---------- */

export interface CategoryRef {
  id: string;
  slug: string;
  name: string;
  icon: string;
  color: string;
}

/** GET /categories */
export interface Category extends CategoryRef {
  description: string;
  activeQuestionCount: number;
}

/** GET /me/summary (completed rounds only) */
export interface MeSummary {
  totalPoints: number;
  roundsPlayed: number;
  badges: { code: string; icon: string; name: string; earnedAt: string }[];
  perCategory: {
    categoryId: string;
    name: string;
    roundsPlayed: number;
    /** 0–100 */
    accuracy: number;
    bestScore: number;
  }[];
}

/** GET /game/history: one finished round */
export interface HistoryEntry {
  id: string;
  category: CategoryRef;
  difficulty: Difficulty;
  totalScore: number;
  /** 0–100 */
  accuracy: number;
  correctCount: number;
  totalItems: number;
  endedAt: string | null;
}

/** The item being played. Never contains the answer. */
export interface Item {
  /** 1-based position in the round. */
  index: number;
  type: QuestionType;
  difficulty: Difficulty;
  questionText: string;
  codeSnippet: string | null;
  imageUrl: string | null;
  /** MULTIPLE_CHOICE only */
  choices?: string[];
  /** WORD_PUZZLE only */
  answerLength?: number;
  wordLengths?: number[];
  scrambledLetters?: string[];
}

/** POST /game/sessions and GET /game/sessions/:id/current */
export interface RoundState {
  sessionId: string;
  category: CategoryRef;
  difficulty: Difficulty;
  totalItems: number;
  secondsPerItem: number;
  hintsAllowed: number;
  hintPenalty: number;
  totalScore: number;
  /** isCorrect of each item answered so far. */
  results: boolean[];
  /** Seconds left on the current item by the server's clock. */
  secondsRemaining: number;
  hintUsed: boolean;
  hint: string | null;
  item: Item;
}

/* ---------- calls ---------- */

export async function fetchCategories(): Promise<Category[]> {
  const { data } = await api.get<Category[]>('/categories');
  return data;
}

export async function fetchSummary(): Promise<MeSummary> {
  const { data } = await api.get<MeSummary>('/me/summary');
  return data;
}

/** The student's finished rounds, newest first. */
export async function fetchHistory(limit = 20): Promise<HistoryEntry[]> {
  const { data } = await api.get<HistoryEntry[]>('/game/history', {
    params: { limit },
  });
  return data;
}

/**
 * Starts a round (abandoning any unfinished one). The response already holds
 * item 1 with its clock running, so the play screen must not call /current
 * straight after this.
 */
export async function startRound(
  categoryId: string,
  difficulty: Difficulty,
): Promise<RoundState> {
  const { data } = await api.post<RoundState>('/game/sessions', {
    categoryId,
    difficulty,
  });
  return data;
}

/* ---------- playing a round ---------- */

/** POST /game/sessions/:id/answers: the result of the item just answered. */
export interface AnswerResult {
  /** 1-based position of the item just answered. */
  index: number;
  isCorrect: boolean;
  /** Judged by the server's clock (time limit plus a 2 s grace). */
  timedOut: boolean;
  correctAnswer: string;
  explanation: string;
  pointsEarned: number;
  totalScore: number;
  correctCount: number;
  answeredCount: number;
  totalItems: number;
  /** Every item is answered: finish the round next. */
  isLastItem: boolean;
}

export interface SessionSummary {
  id: string;
  category: CategoryRef;
  difficulty: Difficulty;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  startedAt: string;
  endedAt: string | null;
  totalScore: number;
  correctCount: number;
  totalItems: number;
  /** 0–100 */
  accuracy: number;
  /** Seconds */
  timeSpent: number;
  hintsUsed: number;
}

export interface ReviewItem {
  index: number;
  type: QuestionType;
  questionText: string;
  /** Empty when the time ran out. */
  submitted: string;
  correctAnswer: string;
  explanation: string;
  isCorrect: boolean;
  timeTaken: number;
  hintUsed: boolean;
  pointsEarned: number;
}

/** GET /game/sessions/:id: a completed round */
export interface SessionResult {
  session: SessionSummary;
  rankInCategory: number | null;
  totalPlayersInCategory: number;
  review: ReviewItem[];
}

export interface NewBadge {
  code: string;
  icon: string;
  name: string;
  description: string;
}

/** POST /game/sessions/:id/finish */
export interface FinishResult extends SessionResult {
  newBadges: NewBadge[];
}

/**
 * The next unanswered item. Starts its clock the first time it is sent;
 * asking again returns the same item with the time left. 409 once every
 * item is answered or the round is over.
 */
export async function fetchCurrent(sessionId: string): Promise<RoundState> {
  const { data } = await api.get<RoundState>(`/game/sessions/${sessionId}/current`);
  return data;
}

export async function requestHint(sessionId: string): Promise<string> {
  const { data } = await api.post<{ hint: string }>(`/game/sessions/${sessionId}/hint`);
  return data.hint;
}

/** `submitted` undefined means the timer ran out. */
export async function submitAnswer(
  sessionId: string,
  index: number,
  submitted: string | undefined,
): Promise<AnswerResult> {
  const { data } = await api.post<AnswerResult>(`/game/sessions/${sessionId}/answers`, {
    index,
    ...(submitted === undefined ? {} : { submitted }),
  });
  return data;
}

export async function finishRound(sessionId: string): Promise<FinishResult> {
  const { data } = await api.post<FinishResult>(`/game/sessions/${sessionId}/finish`);
  return data;
}

export async function abandonRound(sessionId: string): Promise<void> {
  await api.post(`/game/sessions/${sessionId}/abandon`);
}

export async function fetchRound(sessionId: string): Promise<SessionResult> {
  const { data } = await api.get<SessionResult>(`/game/sessions/${sessionId}`);
  return data;
}

/*
 * The result screen loads the round with GET /game/sessions/:id, which does
 * not list the badges earned by it. The play screen keeps the /finish
 * response here so the result screen can show them right after the round.
 */
const justFinished = new Map<string, FinishResult>();

export function rememberFinished(result: FinishResult): void {
  justFinished.set(result.session.id, result);
}

/** The /finish response for this round, if it was finished since the app started. */
export function finishedResult(sessionId: string): FinishResult | null {
  return justFinished.get(sessionId) ?? null;
}

/** Full URL of a question picture; the API stores "/static/images/x.svg". */
export function imageSource(imageUrl: string): string {
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  const base = (api.defaults.baseURL ?? '').replace(/\/+$/, '').replace(/\/api$/, '');
  return `${base}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
}
