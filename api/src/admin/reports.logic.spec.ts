import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  activityReport,
  dayKey,
  dayStart,
  missedItems,
  missedTopics,
  reportRange,
  scoresReport,
  weekStart,
  type QuestionTally,
  type ReportQuestion,
  type ReportSession,
} from './reports.logic.js';

const prog = { id: 'c1', slug: 'prog', name: 'Programming', icon: '💻', color: '#6C4CF1' };
const net = { id: 'c2', slug: 'net', name: 'Networking', icon: '🌐', color: '#10B981' };
const categories = [prog, net];

/** 2026-10-04 10:00 in the Philippines. */
const NOW = new Date('2026-10-04T02:00:00Z');

const session = (over: Partial<ReportSession>): ReportSession => ({
  userId: 'u1',
  categoryId: 'c1',
  difficulty: 'EASY',
  startedAt: new Date('2026-10-03T02:00:00Z'),
  endedAt: new Date('2026-10-03T02:05:00Z'),
  totalScore: 50,
  correctCount: 4,
  totalItems: 5,
  ...over,
});

describe('dates (Philippine time, UTC+8)', () => {
  it('files a round by the Philippine calendar day', () => {
    // 2026-10-03 23:30 UTC is already 07:30 on 2026-10-04 in Dumingag.
    expect(dayKey(new Date('2026-10-03T23:30:00Z'))).toBe('2026-10-04');
    expect(dayKey(new Date('2026-10-03T15:59:59Z'))).toBe('2026-10-03');
    expect(dayStart('2026-10-04').toISOString()).toBe('2026-10-03T16:00:00.000Z');
  });

  it('defaults to the last 30 days, today included', () => {
    const r = reportRange(undefined, undefined, NOW);
    expect(r.from).toBe('2026-09-05');
    expect(r.to).toBe('2026-10-04');
    expect(r.days).toHaveLength(30);
    expect(r.start.toISOString()).toBe('2026-09-04T16:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-10-04T16:00:00.000Z');
  });

  it('takes an explicit period, both ends inclusive', () => {
    const r = reportRange('2026-02-27', '2026-03-01', NOW);
    expect(r.days).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
  });

  it('refuses bad dates, reversed and over-long periods', () => {
    expect(() => reportRange('2026-02-30', undefined, NOW)).toThrow(BadRequestException);
    expect(() => reportRange('2026-10-05', '2026-10-01', NOW)).toThrow(/on or before/);
    expect(() => reportRange('2024-01-01', '2026-01-01', NOW)).toThrow(/at most 366 days/);
  });

  it('starts the week on Monday', () => {
    // 2026-10-04 is a Sunday.
    expect(weekStart(NOW).toISOString()).toBe(dayStart('2026-09-28').toISOString());
  });
});

describe('activityReport', () => {
  const students = new Map([
    ['u1', { id: 'u1', fullName: 'Ana', email: 'ana@x', yearLevel: '1st Year' }],
    ['u2', { id: 'u2', fullName: 'Ben', email: 'ben@x', yearLevel: '2nd Year' }],
  ]);
  const range = { from: '2026-10-02', to: '2026-10-04', days: ['2026-10-02', '2026-10-03', '2026-10-04'] };

  it('counts players, rounds per day and per category, and ranks players by points', () => {
    const report = activityReport(
      range,
      [
        session({ userId: 'u1', totalScore: 40, correctCount: 3 }),
        session({ userId: 'u1', categoryId: 'c2', startedAt: new Date('2026-10-04T01:00:00Z'), endedAt: new Date('2026-10-04T01:03:00Z'), totalScore: 30, correctCount: 2 }),
        session({ userId: 'u2', totalScore: 90, correctCount: 5 }),
      ],
      students,
      categories,
    );
    expect(report.activePlayers).toBe(2);
    expect(report.rounds).toBe(3);
    expect(report.answers).toBe(15);
    expect(report.accuracy).toBe(67); // 10 of 15
    expect(report.roundsPerDay).toEqual([
      { date: '2026-10-02', rounds: 0 },
      { date: '2026-10-03', rounds: 2 },
      { date: '2026-10-04', rounds: 1 },
    ]);
    expect(report.roundsPerCategory.map((r) => r.rounds)).toEqual([2, 1]);
    expect(report.players.map((p) => [p.rank, p.student.fullName, p.points, p.accuracy])).toEqual([
      [1, 'Ben', 90, 100],
      [2, 'Ana', 70, 50],
    ]);
    expect(report.players[1]!.lastPlayed).toEqual(new Date('2026-10-04T01:03:00Z'));
  });

  it('breaks ties by accuracy, then name', () => {
    const report = activityReport(
      range,
      [
        session({ userId: 'u2', totalScore: 50, correctCount: 4 }),
        session({ userId: 'u1', totalScore: 50, correctCount: 4 }),
      ],
      students,
      categories,
    );
    expect(report.players.map((p) => p.student.fullName)).toEqual(['Ana', 'Ben']);
  });

  it('counts every round in the totals even without a student row', () => {
    const report = activityReport(range, [session({ userId: 'gone' })], new Map(), categories);
    expect(report.rounds).toBe(1);
    expect(report.activePlayers).toBe(1);
    expect(report.players).toEqual([]);
  });

  it('is all zeros with no rounds', () => {
    const report = activityReport(range, [], students, categories);
    expect(report).toMatchObject({ activePlayers: 0, rounds: 0, answers: 0, accuracy: 0, players: [] });
  });
});

describe('scoresReport', () => {
  it('averages score and accuracy per category and per difficulty, listing empty ones', () => {
    const report = scoresReport(
      { from: 'a', to: 'b' },
      [
        session({ totalScore: 40, correctCount: 3 }),
        session({ totalScore: 61, correctCount: 5, difficulty: 'AVERAGE' }),
      ],
      categories,
    );
    expect(report.byCategory).toEqual([
      { category: prog, rounds: 2, avgScore: 51, accuracy: 80 },
      { category: net, rounds: 0, avgScore: 0, accuracy: 0 },
    ]);
    expect(report.byDifficulty).toEqual([
      { difficulty: 'EASY', rounds: 1, avgScore: 40, accuracy: 60 },
      { difficulty: 'AVERAGE', rounds: 1, avgScore: 61, accuracy: 100 },
      { difficulty: 'DIFFICULT', rounds: 0, avgScore: 0, accuracy: 0 },
    ]);
  });
});

describe('missedItems / missedTopics', () => {
  const q = (id: string, over: Partial<ReportQuestion> = {}): ReportQuestion => ({
    id,
    categoryId: 'c1',
    type: 'MULTIPLE_CHOICE',
    difficulty: 'EASY',
    questionText: `Question ${id}`,
    answer: 'x',
    topic: 'Loops',
    isActive: true,
    ...over,
  });
  const questions = new Map([
    ['q1', q('q1')],
    ['q2', q('q2', { topic: null })],
    ['q3', q('q3', { categoryId: 'c2', topic: 'OSI' })],
    ['q4', q('q4')],
  ]);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const tallies: QuestionTally[] = [
    { questionId: 'q1', attempts: 10, wrong: 5 }, // 50 %
    { questionId: 'q2', attempts: 4, wrong: 3 }, // 75 %
    { questionId: 'q3', attempts: 1, wrong: 1 }, // 100 %, but only 1 attempt
    { questionId: 'q4', attempts: 6, wrong: 0 },
    { questionId: 'deleted', attempts: 9, wrong: 9 },
  ];

  it('leaves out items under the attempts threshold, never-missed and unknown items', () => {
    const items = missedItems(tallies, questions, byId, { minAttempts: 3, limit: 20 });
    expect(items.map((m) => [m.question.id, m.wrong, m.attempts, m.wrongRate])).toEqual([
      ['q2', 3, 4, 75],
      ['q1', 5, 10, 50],
    ]);
    expect(items[0]!.question.category).toBe(prog);
  });

  it('lists 1-attempt items when the threshold is 1, and respects the limit', () => {
    const items = missedItems(tallies, questions, byId, { minAttempts: 1, limit: 2 });
    expect(items.map((m) => m.question.id)).toEqual(['q3', 'q2']);
  });

  it('groups topics per category ("General" when untitled), most wrong first', () => {
    const topics = missedTopics(tallies, questions, byId);
    expect(topics.map((t) => [t.category.id, t.topic, t.wrong, t.attempts, t.wrongRate])).toEqual([
      ['c1', 'Loops', 5, 16, 31],
      ['c1', 'General', 3, 4, 75],
      ['c2', 'OSI', 1, 1, 100],
    ]);
  });
});
