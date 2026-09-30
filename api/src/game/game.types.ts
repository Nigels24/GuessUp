import type { DifficultyKey, QuestionTypeKey } from '../common/game-rules.js';
import type { ItemDto } from './game.logic.js';

export interface CategoryRef {
  id: string;
  slug: string;
  name: string;
  icon: string;
  color: string;
}

/**
 * The round as the app sees it while playing (start and GET /current).
 * Holds nothing that reveals an answer.
 */
export interface RoundState {
  sessionId: string;
  category: CategoryRef;
  difficulty: DifficultyKey;
  totalItems: number;
  secondsPerItem: number;
  hintsAllowed: number;
  hintPenalty: number;
  /** Points so far in this round. */
  totalScore: number;
  /** isCorrect of each item answered so far, for the progress dots. */
  results: boolean[];
  /** Seconds left on the current item by the server's clock. */
  secondsRemaining: number;
  hintUsed: boolean;
  /** The hint text, only once it has been used on this item. */
  hint: string | null;
  item: ItemDto;
}

export interface AnswerResult {
  isCorrect: boolean;
  timedOut: boolean;
  correctAnswer: string;
  explanation: string;
  pointsEarned: number;
  totalScore: number;
  isLastItem: boolean;
  nextItem: ItemDto | null;
}

export interface SessionSummary {
  id: string;
  category: CategoryRef;
  difficulty: DifficultyKey;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  startedAt: Date;
  endedAt: Date | null;
  totalScore: number;
  correctCount: number;
  totalItems: number;
  accuracy: number;
  timeSpent: number;
  hintsUsed: number;
}

export interface ReviewItem {
  index: number;
  type: QuestionTypeKey;
  questionText: string;
  submitted: string;
  correctAnswer: string;
  explanation: string;
  isCorrect: boolean;
  timeTaken: number;
  hintUsed: boolean;
  pointsEarned: number;
}

export interface NewBadge {
  code: string;
  icon: string;
  name: string;
  description: string;
}

export interface SessionResult {
  session: SessionSummary;
  rankInCategory: number | null;
  totalPlayersInCategory: number;
  review: ReviewItem[];
}

export interface FinishResult extends SessionResult {
  newBadges: NewBadge[];
}

export interface HistoryEntry {
  id: string;
  category: CategoryRef;
  difficulty: DifficultyKey;
  totalScore: number;
  accuracy: number;
  correctCount: number;
  totalItems: number;
  endedAt: Date | null;
}
