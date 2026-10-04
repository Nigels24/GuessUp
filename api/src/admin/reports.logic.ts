/**
 * Report aggregation for the Admin Panel (Reports page, Dashboard). Pure: the
 * service loads rows, these functions count them, so every rule is unit
 * tested. Follows the prototype's categoryStats, missedItems and missedTopics,
 * and counts COMPLETED rounds only, like the student screens.
 */
import { BadRequestException } from '@nestjs/common';
import { accuracyPercent, type DifficultyKey, type QuestionTypeKey } from '../common/game-rules.js';
import type { CategoryRef } from '../game/game.types.js';
import { DEFAULT_TOPIC } from '../me/me.progress.js';

/**
 * Days are counted in Philippine time (UTC+8, no daylight saving time), so a
 * round played at 7 a.m. in Dumingag is not filed under the previous day by a
 * server running in UTC.
 */
export const REPORT_UTC_OFFSET_HOURS = 8;
const OFFSET_MS = REPORT_UTC_OFFSET_HOURS * 3_600_000;
const DAY_MS = 86_400_000;

export const DEFAULT_REPORT_DAYS = 30;
export const MAX_REPORT_DAYS = 366;
/** Items answered fewer times than this are left out of "most missed". */
export const DEFAULT_MIN_ATTEMPTS = 3;
export const DEFAULT_MISSED_LIMIT = 20;
export const MISSED_TOPICS_LIMIT = 8;

export const DIFFICULTIES: DifficultyKey[] = ['EASY', 'AVERAGE', 'DIFFICULT'];
export const LEVEL_LABELS: Record<DifficultyKey, string> = {
  EASY: 'Easy',
  AVERAGE: 'Average',
  DIFFICULT: 'Difficult',
};
export const TYPE_LABELS: Record<QuestionTypeKey, string> = {
  MULTIPLE_CHOICE: 'Multiple Choice',
  PICTURE: 'Picture Guess',
  WORD_PUZZLE: 'Word Puzzle',
};

export const RANGE_MESSAGES = {
  badDate: 'Dates must be written as YYYY-MM-DD.',
  order: 'The start date must be on or before the end date.',
  tooLong: `Choose a period of at most ${MAX_REPORT_DAYS} days.`,
} as const;

/* ---------- dates ---------- */

/** The Philippine calendar day of an instant, as YYYY-MM-DD. */
export function dayKey(at: Date): string {
  return new Date(at.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** Midnight (Philippine time) at the start of a YYYY-MM-DD day. */
export function dayStart(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00Z`) - OFFSET_MS);
}

function isDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && dayKey(dayStart(value)) === value;
}

function addDays(day: string, n: number): string {
  return dayKey(new Date(dayStart(day).getTime() + n * DAY_MS));
}

export interface ReportRange {
  /** First day, YYYY-MM-DD (inclusive). */
  from: string;
  /** Last day, YYYY-MM-DD (inclusive). */
  to: string;
  /** Instants for the database query: start <= startedAt < end. */
  start: Date;
  end: Date;
  /** Every day of the period, oldest first. */
  days: string[];
}

/**
 * The report period. Without dates: the last DEFAULT_REPORT_DAYS days up to
 * and including today. With only `from` or only `to`, the other end defaults
 * to today / DEFAULT_REPORT_DAYS before `to`.
 */
export function reportRange(from?: string, to?: string, now: Date = new Date()): ReportRange {
  if ((from && !isDay(from)) || (to && !isDay(to))) {
    throw new BadRequestException(RANGE_MESSAGES.badDate);
  }
  const last = to ?? dayKey(now);
  const first = from ?? addDays(last, -(DEFAULT_REPORT_DAYS - 1));
  if (first > last) throw new BadRequestException(RANGE_MESSAGES.order);

  const days: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) {
    days.push(d);
    if (days.length > MAX_REPORT_DAYS) throw new BadRequestException(RANGE_MESSAGES.tooLong);
  }
  return { from: first, to: last, start: dayStart(first), end: dayStart(addDays(last, 1)), days };
}

/** Monday 00:00 (Philippine time) of the week containing `now`. */
export function weekStart(now: Date = new Date()): Date {
  const today = dayKey(now);
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  return dayStart(addDays(today, -weekday));
}

/* ---------- input rows ---------- */

/** A completed round. */
export interface ReportSession {
  userId: string;
  categoryId: string;
  difficulty: DifficultyKey;
  startedAt: Date;
  endedAt: Date | null;
  totalScore: number;
  correctCount: number;
  totalItems: number;
}

export interface ReportStudent {
  id: string;
  fullName: string;
  email: string;
  yearLevel: string | null;
}

/** Answers to one question within the period: how many, and how many wrong. */
export interface QuestionTally {
  questionId: string;
  attempts: number;
  wrong: number;
}

export interface ReportQuestion {
  id: string;
  categoryId: string;
  type: QuestionTypeKey;
  difficulty: DifficultyKey;
  questionText: string;
  answer: string;
  topic: string | null;
  isActive: boolean;
}

/* ---------- shared totals ---------- */

interface Totals {
  rounds: number;
  points: number;
  correct: number;
  items: number;
}

const emptyTotals = (): Totals => ({ rounds: 0, points: 0, correct: 0, items: 0 });

function add(t: Totals, s: ReportSession): void {
  t.rounds++;
  t.points += s.totalScore;
  t.correct += s.correctCount;
  t.items += s.totalItems;
}

const avgScore = (t: Totals) => (t.rounds ? Math.round(t.points / t.rounds) : 0);

/* ---------- player activity ---------- */

export interface PlayerRow {
  rank: number;
  student: ReportStudent;
  rounds: number;
  points: number;
  accuracy: number;
  lastPlayed: Date | null;
}

export interface ActivityReport {
  from: string;
  to: string;
  /** Students with at least one completed round in the period. */
  activePlayers: number;
  rounds: number;
  /** Items answered (one per item of every completed round). */
  answers: number;
  accuracy: number;
  roundsPerDay: { date: string; rounds: number }[];
  roundsPerCategory: { category: CategoryRef; rounds: number }[];
  /**
   * By points, then accuracy, then name (the prototype's ranking). Only
   * students found in `students` get a row; every round counts in the totals.
   */
  players: PlayerRow[];
}

export function activityReport(
  range: Pick<ReportRange, 'from' | 'to' | 'days'>,
  sessions: readonly ReportSession[],
  students: ReadonlyMap<string, ReportStudent>,
  categories: readonly CategoryRef[],
): ActivityReport {
  const perDay = new Map(range.days.map((d) => [d, 0]));
  const perCategory = new Map(categories.map((c) => [c.id, 0]));
  const perPlayer = new Map<string, Totals & { last: Date | null }>();
  const all = emptyTotals();

  for (const s of sessions) {
    add(all, s);
    const day = dayKey(s.startedAt);
    if (perDay.has(day)) perDay.set(day, perDay.get(day)! + 1);
    if (perCategory.has(s.categoryId)) perCategory.set(s.categoryId, perCategory.get(s.categoryId)! + 1);

    let p = perPlayer.get(s.userId);
    if (!p) {
      p = { ...emptyTotals(), last: null };
      perPlayer.set(s.userId, p);
    }
    add(p, s);
    const ended = s.endedAt ?? s.startedAt;
    if (!p.last || ended > p.last) p.last = ended;
  }

  const players = [...perPlayer.entries()]
    .flatMap(([id, p]) => {
      const student = students.get(id);
      return student ? [{ student, p }] : [];
    })
    .map(({ student, p }) => ({
      student,
      rounds: p.rounds,
      points: p.points,
      accuracy: accuracyPercent(p.correct, p.items),
      lastPlayed: p.last,
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.accuracy - a.accuracy ||
        a.student.fullName.localeCompare(b.student.fullName),
    )
    .map((row, i) => ({ rank: i + 1, ...row }));

  return {
    from: range.from,
    to: range.to,
    activePlayers: perPlayer.size,
    rounds: all.rounds,
    answers: all.items,
    accuracy: accuracyPercent(all.correct, all.items),
    roundsPerDay: [...perDay.entries()].map(([date, rounds]) => ({ date, rounds })),
    roundsPerCategory: categories.map((category) => ({
      category,
      rounds: perCategory.get(category.id) ?? 0,
    })),
    players,
  };
}

/* ---------- average scores ---------- */

export interface ScoreRow {
  rounds: number;
  avgScore: number;
  accuracy: number;
}

export interface ScoresReport {
  from: string;
  to: string;
  /** Every category in display order, also those without rounds (rounds: 0). */
  byCategory: (ScoreRow & { category: CategoryRef })[];
  byDifficulty: (ScoreRow & { difficulty: DifficultyKey })[];
}

export function scoresReport(
  range: Pick<ReportRange, 'from' | 'to'>,
  sessions: readonly ReportSession[],
  categories: readonly CategoryRef[],
): ScoresReport {
  const byCat = new Map(categories.map((c) => [c.id, emptyTotals()]));
  const byLevel = new Map(DIFFICULTIES.map((d) => [d, emptyTotals()]));
  for (const s of sessions) {
    const c = byCat.get(s.categoryId);
    if (c) add(c, s);
    add(byLevel.get(s.difficulty)!, s);
  }
  const row = (t: Totals): ScoreRow => ({
    rounds: t.rounds,
    avgScore: avgScore(t),
    accuracy: accuracyPercent(t.correct, t.items),
  });
  return {
    from: range.from,
    to: range.to,
    byCategory: categories.map((category) => ({ category, ...row(byCat.get(category.id)!) })),
    byDifficulty: DIFFICULTIES.map((difficulty) => ({ difficulty, ...row(byLevel.get(difficulty)!) })),
  };
}

/* ---------- most missed items and topics ---------- */

export interface MissedItem {
  question: ReportQuestion & { category: CategoryRef };
  attempts: number;
  wrong: number;
  /** Wrong answers / attempts, 0–100. */
  wrongRate: number;
}

export interface MissedTopic {
  category: CategoryRef;
  topic: string;
  attempts: number;
  wrong: number;
  wrongRate: number;
}

export interface MostMissedReport {
  from: string;
  to: string;
  minAttempts: number;
  items: MissedItem[];
  topics: MissedTopic[];
}

const rate = (wrong: number, attempts: number) => accuracyPercent(wrong, attempts);

/**
 * Items answered at least `minAttempts` times with at least one wrong answer,
 * highest wrong rate first, then most wrong answers. The threshold keeps an
 * item answered wrongly once (100 %) from topping the list.
 */
export function missedItems(
  tallies: readonly QuestionTally[],
  questions: ReadonlyMap<string, ReportQuestion>,
  categories: ReadonlyMap<string, CategoryRef>,
  options: { minAttempts: number; limit: number },
): MissedItem[] {
  return tallies
    .filter((t) => t.wrong > 0 && t.attempts >= options.minAttempts)
    .flatMap((t) => {
      const question = questions.get(t.questionId);
      const category = question && categories.get(question.categoryId);
      if (!question || !category) return [];
      return [
        {
          question: { ...question, category },
          attempts: t.attempts,
          wrong: t.wrong,
          wrongRate: rate(t.wrong, t.attempts),
        },
      ];
    })
    .sort(
      (a, b) =>
        b.wrongRate - a.wrongRate ||
        b.wrong - a.wrong ||
        a.question.questionText.localeCompare(b.question.questionText),
    )
    .slice(0, options.limit);
}

/**
 * The prototype's "Topics needing reteaching": answers grouped by category and
 * topic (untitled questions count as "General"), most wrong answers first.
 */
export function missedTopics(
  tallies: readonly QuestionTally[],
  questions: ReadonlyMap<string, ReportQuestion>,
  categories: ReadonlyMap<string, CategoryRef>,
  limit = MISSED_TOPICS_LIMIT,
): MissedTopic[] {
  const topics = new Map<string, MissedTopic>();
  for (const t of tallies) {
    const question = questions.get(t.questionId);
    const category = question && categories.get(question.categoryId);
    if (!question || !category) continue;
    const topic = question.topic?.trim() || DEFAULT_TOPIC;
    const key = `${category.id}|${topic}`;
    let row = topics.get(key);
    if (!row) {
      row = { category, topic, attempts: 0, wrong: 0, wrongRate: 0 };
      topics.set(key, row);
    }
    row.attempts += t.attempts;
    row.wrong += t.wrong;
  }
  return [...topics.values()]
    .filter((t) => t.wrong > 0)
    .map((t) => ({ ...t, wrongRate: rate(t.wrong, t.attempts) }))
    .sort((a, b) => b.wrong - a.wrong || b.wrongRate - a.wrongRate || a.topic.localeCompare(b.topic))
    .slice(0, limit);
}
