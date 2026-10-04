import { Injectable, NotFoundException } from '@nestjs/common';
import { CATEGORY_REF } from '../game/game.service.js';
import type { CategoryRef } from '../game/game.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { MostMissedQueryDto, ReportQueryDto } from './dto/report.dto.js';
import {
  DEFAULT_MIN_ATTEMPTS,
  DEFAULT_MISSED_LIMIT,
  activityReport,
  missedItems,
  missedTopics,
  reportRange,
  scoresReport,
  type ActivityReport,
  type MostMissedReport,
  type QuestionTally,
  type ReportQuestion,
  type ReportRange,
  type ReportSession,
  type ReportStudent,
  type ScoresReport,
} from './reports.logic.js';

/**
 * The three thesis reports: player activity, average scores per category,
 * and the items most frequently answered incorrectly. Loads completed rounds
 * of the period from the database; reports.logic.ts does the counting.
 */
@Injectable()
export class AdminReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async activity(query: ReportQueryDto, now = new Date()): Promise<ActivityReport> {
    const range = reportRange(query.from, query.to, now);
    const categories = await this.categories(query.categoryId);
    const sessions = await this.sessions(range, query.categoryId);
    const students = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(sessions.map((s) => s.userId))] } },
      select: { id: true, fullName: true, email: true, yearLevel: true },
    });
    return activityReport(
      range,
      sessions,
      new Map<string, ReportStudent>(students.map((s) => [s.id, s])),
      categories,
    );
  }

  async scores(query: ReportQueryDto, now = new Date()): Promise<ScoresReport> {
    const range = reportRange(query.from, query.to, now);
    const categories = await this.categories(query.categoryId);
    return scoresReport(range, await this.sessions(range, query.categoryId), categories);
  }

  async mostMissed(query: MostMissedQueryDto, now = new Date()): Promise<MostMissedReport> {
    const range = reportRange(query.from, query.to, now);
    const minAttempts = query.minAttempts ?? DEFAULT_MIN_ATTEMPTS;
    const categories = await this.categories(query.categoryId);
    const tallies = await this.tallies(range, query.categoryId);
    const byId = await this.questions(tallies);
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    return {
      from: range.from,
      to: range.to,
      minAttempts,
      items: missedItems(tallies, byId, categoryById, {
        minAttempts,
        limit: query.limit ?? DEFAULT_MISSED_LIMIT,
      }),
      topics: missedTopics(tallies, byId, categoryById),
    };
  }

  /* ---------- loaders (also used by the dashboard) ---------- */

  /** All categories in display order, or just the one asked for (404 if unknown). */
  async categories(categoryId?: string): Promise<CategoryRef[]> {
    const categories = await this.prisma.category.findMany({
      where: categoryId ? { id: categoryId } : undefined,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: CATEGORY_REF,
    });
    if (categoryId && !categories.length) throw new NotFoundException('Category not found.');
    return categories;
  }

  /** The questions behind a list of tallies, by id. */
  async questions(tallies: readonly QuestionTally[]): Promise<Map<string, ReportQuestion>> {
    const questions = await this.prisma.question.findMany({
      where: { id: { in: tallies.map((t) => t.questionId) } },
      select: {
        id: true,
        categoryId: true,
        type: true,
        difficulty: true,
        questionText: true,
        answer: true,
        topic: true,
        isActive: true,
      },
    });
    return new Map(questions.map((q) => [q.id, q]));
  }

  /** Completed rounds that started within the period. */
  async sessions(range: Pick<ReportRange, 'start' | 'end'>, categoryId?: string): Promise<ReportSession[]> {
    return this.prisma.gameSession.findMany({
      where: {
        status: 'COMPLETED',
        startedAt: { gte: range.start, lt: range.end },
        categoryId: categoryId || undefined,
      },
      select: {
        userId: true,
        categoryId: true,
        difficulty: true,
        startedAt: true,
        endedAt: true,
        totalScore: true,
        correctCount: true,
        totalItems: true,
      },
    });
  }

  /** Answers per question (and wrong answers) in completed rounds of the period. */
  async tallies(range: Pick<ReportRange, 'start' | 'end'>, categoryId?: string): Promise<QuestionTally[]> {
    const session = {
      status: 'COMPLETED' as const,
      startedAt: { gte: range.start, lt: range.end },
      categoryId: categoryId || undefined,
    };
    const [all, wrong] = await Promise.all([
      this.prisma.answer.groupBy({ by: ['questionId'], where: { session }, _count: { _all: true } }),
      this.prisma.answer.groupBy({
        by: ['questionId'],
        where: { session, isCorrect: false },
        _count: { _all: true },
      }),
    ]);
    const wrongById = new Map(wrong.map((w) => [w.questionId, w._count._all]));
    return all.map((a) => ({
      questionId: a.questionId,
      attempts: a._count._all,
      wrong: wrongById.get(a.questionId) ?? 0,
    }));
  }
}
