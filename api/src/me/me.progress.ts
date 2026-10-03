/**
 * The student's My Progress screen (GET /me/progress), built from completed
 * rounds only. Pure, so the counting rules are unit tested. Follows the
 * prototype's categoryStats and missedTopics.
 */
import { accuracyPercent } from '../common/game-rules.js';
import type { CategoryRef, HistoryEntry } from '../game/game.types.js';
import { categoryStats, type SummarySession } from './me.summary.js';

/** How many topics "Topics to review" lists, like the prototype. */
export const TOPICS_TO_REVIEW = 5;
/** Topic shown for questions saved without one, like the prototype. */
export const DEFAULT_TOPIC = 'General';

/** One answer from a completed round, with its question's category and topic. */
export interface ProgressAnswer {
  isCorrect: boolean;
  categoryId: string;
  topic: string | null;
}

export interface CategoryAccuracy {
  category: CategoryRef;
  roundsPlayed: number;
  /** Correct items / items answered in this category, 0–100. */
  accuracy: number;
  avgScore: number;
}

export interface TopicToReview {
  category: CategoryRef;
  topic: string;
  /** Items answered on this topic. */
  attempts: number;
  correct: number;
  wrong: number;
}

export interface MeProgress {
  roundsPlayed: number;
  totalPoints: number;
  /** Correct items / items answered across every completed round, 0–100. */
  accuracy: number;
  /** Categories the student has completed a round in, in category order. */
  perCategory: CategoryAccuracy[];
  /** Most often missed first; topics never missed are left out. */
  topicsToReview: TopicToReview[];
  /** The score history: the latest completed rounds, newest first. */
  history: HistoryEntry[];
}

/**
 * `sessions` and `answers` must come from the student's COMPLETED rounds;
 * `history` is passed through as is. Answers in a category not in
 * `categories` are skipped.
 */
export function buildProgress(
  categories: readonly CategoryRef[],
  sessions: readonly SummarySession[],
  answers: readonly ProgressAnswer[],
  history: HistoryEntry[],
): MeProgress {
  const perCategory = categories.flatMap((category) => {
    const { roundsPlayed, accuracy, avgScore } = categoryStats(category.id, sessions);
    return roundsPlayed ? [{ category, roundsPlayed, accuracy, avgScore }] : [];
  });

  const byId = new Map(categories.map((c) => [c.id, c]));
  const topics = new Map<string, TopicToReview>();
  for (const answer of answers) {
    const category = byId.get(answer.categoryId);
    if (!category) continue;
    const topic = answer.topic?.trim() || DEFAULT_TOPIC;
    const key = `${category.id}|${topic}`;
    let row = topics.get(key);
    if (!row) {
      row = { category, topic, attempts: 0, correct: 0, wrong: 0 };
      topics.set(key, row);
    }
    row.attempts++;
    if (answer.isCorrect) row.correct++;
    else row.wrong++;
  }
  const topicsToReview = [...topics.values()]
    .filter((t) => t.wrong > 0)
    .sort(
      (a, b) =>
        b.wrong - a.wrong ||
        b.wrong / b.attempts - a.wrong / a.attempts ||
        a.topic.localeCompare(b.topic),
    )
    .slice(0, TOPICS_TO_REVIEW);

  const correct = sessions.reduce((sum, s) => sum + s.correctCount, 0);
  const answered = sessions.reduce((sum, s) => sum + s.totalItems, 0);
  return {
    roundsPlayed: sessions.length,
    totalPoints: sessions.reduce((sum, s) => sum + s.totalScore, 0),
    accuracy: accuracyPercent(correct, answered),
    perCategory,
    topicsToReview,
    history,
  };
}
