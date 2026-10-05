import { Injectable } from '@nestjs/common';
import { CATEGORY_REF } from '../game/game.service.js';
import type { CategoryRef } from '../game/game.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdminReportsService } from './admin-reports.service.js';
import {
  DEFAULT_MIN_ATTEMPTS,
  activityReport,
  dayKey,
  dayStart,
  missedItems,
  reportRange,
  scoresReport,
  weekStart,
  type MissedItem,
  type ScoreRow,
} from './reports.logic.js';

/** Days in the dashboard's "Rounds per day" chart, as in the prototype. */
export const DASHBOARD_CHART_DAYS = 14;
export const DASHBOARD_MISSED = 5;
export const DASHBOARD_RECENT = 7;

export interface DashboardSummary {
  /** The overview period: the last 30 days. */
  from: string;
  to: string;
  students: { total: number; active: number };
  questions: { active: number; inactive: number };
  /** Completed rounds. */
  rounds: { last30Days: number; today: number; thisWeek: number };
  accuracy: number;
  categoryAccuracy: (ScoreRow & { category: CategoryRef })[];
  roundsPerDay: { date: string; rounds: number }[];
  mostMissed: MissedItem[];
  recentSessions: {
    id: string;
    user: { id: string; fullName: string; avatarUrl: string | null };
    category: CategoryRef;
    difficulty: string;
    totalScore: number;
    accuracy: number;
    endedAt: Date | null;
  }[];
}

/** The prototype's Dashboard: activity in the last 30 days. */
@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: AdminReportsService,
  ) {}

  async summary(now = new Date()): Promise<DashboardSummary> {
    const range = reportRange(undefined, undefined, now);
    const completedSince = (since: Date) =>
      this.prisma.gameSession.count({ where: { status: 'COMPLETED', startedAt: { gte: since } } });

    const [
      categories,
      sessions,
      tallies,
      studentsTotal,
      studentsActive,
      questionsActive,
      questionsInactive,
      today,
      thisWeek,
      recent,
    ] = await Promise.all([
      this.reports.categories(),
      this.reports.sessions(range),
      this.reports.tallies(range),
      this.prisma.user.count({ where: { role: 'STUDENT' } }),
      this.prisma.user.count({ where: { role: 'STUDENT', status: 'ACTIVE' } }),
      this.prisma.question.count({ where: { isActive: true } }),
      this.prisma.question.count({ where: { isActive: false } }),
      completedSince(dayStart(dayKey(now))),
      completedSince(weekStart(now)),
      this.prisma.gameSession.findMany({
        where: { status: 'COMPLETED' },
        orderBy: { endedAt: 'desc' },
        take: DASHBOARD_RECENT,
        include: {
          user: { select: { id: true, fullName: true, avatarUrl: true } },
          category: { select: CATEGORY_REF },
        },
      }),
    ]);

    const questions = await this.reports.questions(tallies);
    const activity = activityReport(range, sessions, new Map(), categories);

    return {
      from: range.from,
      to: range.to,
      students: { total: studentsTotal, active: studentsActive },
      questions: { active: questionsActive, inactive: questionsInactive },
      rounds: { last30Days: activity.rounds, today, thisWeek },
      accuracy: activity.accuracy,
      categoryAccuracy: scoresReport(range, sessions, categories).byCategory,
      roundsPerDay: activity.roundsPerDay.slice(-DASHBOARD_CHART_DAYS),
      mostMissed: missedItems(
        tallies,
        questions,
        new Map(categories.map((c) => [c.id, c])),
        { minAttempts: DEFAULT_MIN_ATTEMPTS, limit: DASHBOARD_MISSED },
      ),
      recentSessions: recent.map((s) => ({
        id: s.id,
        user: s.user,
        category: s.category,
        difficulty: s.difficulty,
        totalScore: s.totalScore,
        accuracy: s.accuracy,
        endedAt: s.endedAt,
      })),
    };
  }
}
