import { describe, expect, it } from 'vitest';
import { BADGES, badgeStats, evaluateBadges } from '../../src/common/badges.js';
import { LEVELS, accuracyPercent, checkAnswer, type DifficultyKey } from '../../src/common/game-rules.js';
import { missedItems, type QuestionTally, type ReportQuestion } from '../../src/admin/reports.logic.js';
import {
  DEMO_DAYS,
  buildDemoPlan,
  demoEmail,
  isDemoEmail,
  type CatalogCategory,
  type CatalogQuestion,
} from './plan.js';

const SLUGS = ['prog', 'dsa', 'dbms', 'net', 'web', 'sad', 'ias'];
const LEVEL_KEYS: DifficultyKey[] = ['EASY', 'AVERAGE', 'DIFFICULT'];
const categories: CatalogCategory[] = SLUGS.map((slug) => ({ id: `cat-${slug}`, slug, name: slug.toUpperCase() }));
/** Like the seed: 5 items per category and difficulty, all three types. */
const questions: CatalogQuestion[] = categories.flatMap((c) =>
  LEVEL_KEYS.flatMap((difficulty) =>
    [0, 1, 2, 3, 4].map((n): CatalogQuestion => {
      const id = `${c.slug}-${difficulty}-${n}`;
      if (n < 3) {
        return { id, categoryId: c.id, difficulty, type: 'MULTIPLE_CHOICE', answer: `Answer ${id}`, alternates: [], choices: [`Wrong A ${id}`, `Wrong B ${id}`, `Wrong C ${id}`] };
      }
      const type = n === 3 ? 'PICTURE' : 'WORD_PUZZLE';
      return { id, categoryId: c.id, difficulty, type, answer: `WORD ${c.slug}${difficulty}${n}`, alternates: n === 3 ? [`alt ${id}`] : [], choices: [] };
    }),
  ),
);

const NOW = new Date('2026-10-07T04:00:00Z'); // noon in the Philippines
let counter = 0;
const plan = buildDemoPlan({ categories, questions, now: NOW, seed: 2026, newId: () => `id${++counter}` });
const completed = plan.sessions.filter((s) => s.status === 'COMPLETED');
const abandoned = plan.sessions.filter((s) => s.status === 'ABANDONED');
const answersOf = (sessionId: string) => plan.answers.filter((a) => a.sessionId === sessionId);
const questionById = new Map(questions.map((q) => [q.id, q]));

describe('demo plan: the accounts', () => {
  it('only uses @demo.jhcsc.edu.ph emails, all different', () => {
    expect(plan.students.length).toBeGreaterThanOrEqual(22);
    expect(plan.students.length).toBeLessThanOrEqual(25);
    for (const s of plan.students) expect(isDemoEmail(s.email), s.email).toBe(true);
    expect(new Set(plan.students.map((s) => s.email)).size).toBe(plan.students.length);
    expect(demoEmail('Mark Anthony', 'Villanueva')).toBe('markanthony.villanueva@demo.jhcsc.edu.ph');
  });

  it('the marker never matches real accounts', () => {
    for (const email of ['student@jhcsc.edu.ph', 'admin@jhcsc.edu.ph', 'matthew@gmail.com', 'x@notdemo.jhcsc.edu.ph', 'demo.jhcsc.edu.ph@gmail.com']) {
      expect(isDemoEmail(email), email).toBe(false);
    }
    expect(isDemoEmail('Juan.Cruz@DEMO.jhcsc.edu.ph')).toBe(true);
  });

  it('mixes year levels and signs every student up before their first round', () => {
    expect(new Set(plan.students.map((s) => s.yearLevel)).size).toBe(4);
    for (const s of plan.students) {
      const first = Math.min(...plan.sessions.filter((x) => x.userId === s.id).map((x) => x.startedAt.getTime()));
      expect(s.createdAt.getTime()).toBeLessThan(first);
    }
  });
});

describe('demo plan: the rounds', () => {
  it('has a realistic amount of play over the last 21 days, in the past', () => {
    expect(completed.length).toBeGreaterThanOrEqual(150);
    expect(completed.length).toBeLessThanOrEqual(250);
    expect(abandoned.length).toBeGreaterThanOrEqual(2);
    expect(abandoned.length).toBeLessThanOrEqual(15);
    const earliest = NOW.getTime() - (DEMO_DAYS + 1) * 86_400_000;
    for (const s of plan.sessions) {
      expect(s.startedAt.getTime()).toBeGreaterThan(earliest);
      expect(s.endedAt.getTime()).toBeLessThan(NOW.getTime());
    }
  });

  it('covers every category and level, with more Easy than Difficult rounds', () => {
    expect(new Set(completed.map((s) => s.categoryId)).size).toBe(7);
    const per = (d: DifficultyKey) => completed.filter((s) => s.difficulty === d).length;
    expect(per('DIFFICULT')).toBeGreaterThan(0);
    expect(per('EASY')).toBeGreaterThan(per('AVERAGE'));
    expect(per('AVERAGE')).toBeGreaterThan(per('DIFFICULT'));
  });

  it('draws 5 items of the round’s category and difficulty, each answered once in order', () => {
    for (const s of completed) {
      expect(s.itemIds).toHaveLength(5);
      expect(new Set(s.itemIds).size).toBe(5);
      for (const id of s.itemIds) {
        expect(questionById.get(id)!.categoryId).toBe(s.categoryId);
        expect(questionById.get(id)!.difficulty).toBe(s.difficulty);
      }
      const answers = answersOf(s.id);
      expect(answers.map((a) => a.questionId)).toEqual(s.itemIds);
      for (let i = 1; i < answers.length; i++) {
        expect(answers[i]!.createdAt.getTime()).toBeGreaterThan(answers[i - 1]!.createdAt.getTime());
      }
      expect(answers[0]!.createdAt.getTime()).toBeGreaterThan(s.startedAt.getTime());
      expect(s.endedAt.getTime()).toBeGreaterThan(answers.at(-1)!.createdAt.getTime());
    }
  });

  it('never has two rounds of one student at the same time', () => {
    for (const st of plan.students) {
      const mine = plan.sessions.filter((s) => s.userId === st.id).sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
      for (let i = 1; i < mine.length; i++) {
        expect(mine[i]!.startedAt.getTime()).toBeGreaterThan(mine[i - 1]!.endedAt.getTime());
      }
    }
  });

  it('totals each completed round like GameService.finish', () => {
    for (const s of completed) {
      const answers = answersOf(s.id);
      const correct = answers.filter((a) => a.isCorrect).length;
      expect(s).toMatchObject({
        totalScore: answers.reduce((sum, a) => sum + a.pointsEarned, 0),
        correctCount: correct,
        totalItems: 5,
        accuracy: accuracyPercent(correct, 5),
        timeSpent: answers.reduce((sum, a) => sum + a.timeTaken, 0),
        hintsUsed: answers.filter((a) => a.hintUsed).length,
        currentIndex: 5,
      });
    }
  });

  it('leaves abandoned rounds as the API does: score so far, nothing totalled', () => {
    for (const s of abandoned) {
      const answers = answersOf(s.id);
      expect(answers.length).toBeLessThan(s.totalItems);
      expect(s.currentIndex).toBe(answers.length);
      expect(s.totalScore).toBe(answers.reduce((sum, a) => sum + a.pointsEarned, 0));
      expect(s).toMatchObject({ correctCount: 0, accuracy: 0, timeSpent: 0, hintsUsed: 0 });
    }
  });
});

describe('demo plan: the answers', () => {
  it('are judged by the API rules: within the timer, hints only where allowed, points from scoreAnswer', () => {
    for (const s of plan.sessions) {
      const level = LEVELS[s.difficulty];
      for (const a of answersOf(s.id)) {
        const q = questionById.get(a.questionId)!;
        expect(a.timeTaken).toBeGreaterThanOrEqual(1);
        expect(a.timeTaken).toBeLessThanOrEqual(level.seconds);
        if (!level.hints) expect(a.hintUsed).toBe(false);
        expect(a.isCorrect).toBe(checkAnswer(q, a.submitted));
        if (!a.isCorrect) expect(a.pointsEarned).toBe(0);
        else {
          // scoreAnswer: base + speed bonus − hint penalty; at least 1.
          const max = level.points * 1.5 - (a.hintUsed ? level.hintPenalty : 0);
          const min = level.points - (a.hintUsed ? level.hintPenalty : 0);
          expect(a.pointsEarned).toBeGreaterThanOrEqual(Math.max(1, min));
          expect(a.pointsEarned).toBeLessThanOrEqual(max);
        }
        if (a.kind !== 'answered') {
          expect(a.submitted).toBe('');
          expect(a.isCorrect).toBe(false);
        }
        if (a.kind === 'timeout') expect(a.timeTaken).toBe(level.seconds);
      }
    }
  });

  it('includes hints, timeouts and "I don\'t know" in plausible shares', () => {
    const n = plan.answers.length;
    const share = (k: (typeof plan.answers)[number]['kind']) => plan.answers.filter((a) => a.kind === k).length / n;
    expect(share('timeout')).toBeGreaterThan(0.01);
    expect(share('timeout')).toBeLessThan(0.08);
    expect(share('dont_know')).toBeGreaterThan(0.01);
    expect(share('dont_know')).toBeLessThan(0.08);
    const hints = plan.answers.filter((a) => a.hintUsed).length / n;
    expect(hints).toBeGreaterThan(0.03);
    expect(hints).toBeLessThan(0.2);
    const accuracy = plan.answers.filter((a) => a.isCorrect).length / n;
    expect(accuracy).toBeGreaterThan(0.5);
    expect(accuracy).toBeLessThan(0.85);
  });

  it('makes some items clearly missed more often (the most-missed report, at least 3 attempts)', () => {
    const tallies = new Map<string, QuestionTally>();
    for (const a of plan.answers) {
      const t = tallies.get(a.questionId) ?? { questionId: a.questionId, attempts: 0, wrong: 0 };
      t.attempts += 1;
      if (!a.isCorrect) t.wrong += 1;
      tallies.set(a.questionId, t);
    }
    const reportQuestions = new Map<string, ReportQuestion>(
      questions.map((q) => [q.id, { ...q, questionText: q.id, topic: null, isActive: true }]),
    );
    const categoryRefs = new Map(categories.map((c) => [c.id, { ...c, icon: '', color: '' }]));
    const all = missedItems([...tallies.values()], reportQuestions, categoryRefs, { minAttempts: 3, limit: 1000 });
    expect(all.length).toBeGreaterThan(20);
    // The hardest items stand out from the typical one.
    const median = all[Math.floor(all.length / 2)]!.wrongRate;
    expect(all[4]!.wrongRate).toBeGreaterThanOrEqual(median + 20);
  });
});

describe('demo plan: leaderboard and badges', () => {
  it('leaderboard rows add up the completed rounds per student and category', () => {
    const sum = new Map<string, { p: number; r: number }>();
    for (const s of completed) {
      const k = `${s.userId}|${s.categoryId}`;
      const v = sum.get(k) ?? { p: 0, r: 0 };
      sum.set(k, { p: v.p + s.totalScore, r: v.r + 1 });
    }
    expect(plan.leaderboard).toHaveLength(sum.size);
    for (const row of plan.leaderboard) {
      expect(sum.get(`${row.userId}|${row.categoryId}`)).toEqual({ p: row.totalPoints, r: row.roundsPlayed });
    }
  });

  it('badges include what evaluateBadges gives over the whole history, each earned once when a round ended', () => {
    const active = [...new Set(questions.map((q) => q.categoryId))];
    for (const st of plan.students) {
      const mine = completed.filter((s) => s.userId === st.id);
      const lastEnd = Math.max(...mine.map((s) => s.endedAt.getTime()));
      const answerLog = plan.answers
        .filter((a) => plan.sessions.find((s) => s.id === a.sessionId)!.userId === st.id)
        .filter((a) => a.createdAt.getTime() <= lastEnd)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((a) => a.isCorrect);
      const stats = badgeStats(
        mine.map((s) => ({ categoryId: s.categoryId, difficulty: s.difficulty, accuracy: s.accuracy, hintsUsed: s.hintsUsed })),
        mine.flatMap((s) => answersOf(s.id).map((a) => ({ categoryId: s.categoryId, isCorrect: a.isCorrect, timeTaken: a.timeTaken }))),
        { answerLog, activeCategoryIds: active },
      );
      const got = plan.badges.filter((b) => b.userId === st.id).map((b) => b.badgeCode);
      expect(new Set(got).size, st.email).toBe(got.length);
      // Subject Master can be earned and later fall below 80%; it is kept, as in the API.
      for (const code of evaluateBadges(stats, []).map((b) => b.code)) expect(got, st.email).toContain(code);
      const ends = new Set(mine.map((s) => s.endedAt.getTime()));
      for (const b of plan.badges.filter((x) => x.userId === st.id)) expect(ends.has(b.earnedAt.getTime())).toBe(true);
    }
    // Enough variety to show on the profiles: every prototype badge at least.
    const codes = new Set(plan.badges.map((b) => b.badgeCode));
    expect(BADGES.slice(0, 8).filter((b) => !codes.has(b.code)).length).toBeLessThanOrEqual(1);
  });

  it('is deterministic for a seed', () => {
    let n = 0;
    const again = buildDemoPlan({ categories, questions, now: NOW, seed: 2026, newId: () => `id${++n}` });
    expect(again.sessions.map((s) => [s.startedAt.getTime(), s.totalScore])).toEqual(
      plan.sessions.map((s) => [s.startedAt.getTime(), s.totalScore]),
    );
  });
});
