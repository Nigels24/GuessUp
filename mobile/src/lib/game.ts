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
