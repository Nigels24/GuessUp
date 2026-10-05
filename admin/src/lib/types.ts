/** Shapes returned by the API's /admin routes (api/src/admin). */
import type { Difficulty, QuestionType, SessionStatus } from "./game";

export interface CategoryRef {
  id: string;
  slug: string;
  name: string;
  icon: string;
  color: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminCategory extends CategoryRef {
  description: string;
  questionCount: number;
  activeQuestionCount: number;
  byDifficulty: Record<Difficulty, { total: number; active: number }>;
  sessionCount: number;
}

export interface AdminQuestion {
  id: string;
  seedKey: string | null;
  category: CategoryRef;
  type: QuestionType;
  difficulty: Difficulty;
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
  answerCount: number;
}

export interface QuestionPayload {
  categoryId: string;
  type: QuestionType;
  difficulty: Difficulty;
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

export interface DeleteResult {
  outcome: "DELETED" | "DEACTIVATED";
  message: string;
}

export interface UploadedImage {
  url: string;
  publicId: string;
}

export interface StudentRow {
  id: string;
  fullName: string;
  email: string;
  yearLevel: string | null;
  status: "ACTIVE" | "INACTIVE";
  /** Profile photo; null shows the initials. */
  avatarUrl: string | null;
  createdAt: string;
  rounds: number;
  totalPoints: number;
  accuracy: number;
  lastActive: string | null;
}

export interface StudentDetail extends StudentRow {
  perCategory: { category: CategoryRef; roundsPlayed: number; accuracy: number; avgScore: number }[];
  topicsToReview: { category: CategoryRef; topic: string; attempts: number; correct: number; wrong: number }[];
  badges: { code: string; icon: string; name: string; earnedAt: string }[];
}

export interface SessionRow {
  id: string;
  user: { id: string; fullName: string; email: string; yearLevel: string | null; avatarUrl: string | null };
  category: CategoryRef;
  difficulty: Difficulty;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  totalScore: number;
  correctCount: number;
  totalItems: number;
  accuracy: number;
  timeSpent: number;
  hintsUsed: number;
  answeredCount: number;
}

export interface SessionDetail extends SessionRow {
  answers: {
    index: number;
    question: { id: string; type: QuestionType; questionText: string; answer: string; topic: string | null };
    submitted: string;
    isCorrect: boolean;
    hintUsed: boolean;
    timeTaken: number;
    pointsEarned: number;
  }[];
}

export interface PlayerRow {
  rank: number;
  student: { id: string; fullName: string; email: string; yearLevel: string | null };
  rounds: number;
  points: number;
  accuracy: number;
  lastPlayed: string | null;
}

export interface ActivityReport {
  from: string;
  to: string;
  activePlayers: number;
  rounds: number;
  answers: number;
  accuracy: number;
  roundsPerDay: { date: string; rounds: number }[];
  roundsPerCategory: { category: CategoryRef; rounds: number }[];
  players: PlayerRow[];
}

export interface ScoreRow {
  rounds: number;
  avgScore: number;
  accuracy: number;
}

export interface ScoresReport {
  from: string;
  to: string;
  byCategory: (ScoreRow & { category: CategoryRef })[];
  byDifficulty: (ScoreRow & { difficulty: Difficulty })[];
}

export interface MissedItem {
  question: {
    id: string;
    type: QuestionType;
    difficulty: Difficulty;
    questionText: string;
    answer: string;
    topic: string | null;
    isActive: boolean;
    category: CategoryRef;
  };
  attempts: number;
  wrong: number;
  wrongRate: number;
}

export interface MostMissedReport {
  from: string;
  to: string;
  minAttempts: number;
  items: MissedItem[];
  topics: { category: CategoryRef; topic: string; attempts: number; wrong: number; wrongRate: number }[];
}

export interface DashboardSummary {
  from: string;
  to: string;
  students: { total: number; active: number };
  questions: { active: number; inactive: number };
  rounds: { last30Days: number; today: number; thisWeek: number };
  accuracy: number;
  categoryAccuracy: (ScoreRow & { category: CategoryRef })[];
  roundsPerDay: { date: string; rounds: number }[];
  mostMissed: MissedItem[];
  recentSessions: {
    id: string;
    user: { id: string; fullName: string; avatarUrl: string | null };
    category: CategoryRef;
    difficulty: Difficulty;
    totalScore: number;
    accuracy: number;
    endedAt: string | null;
  }[];
}
