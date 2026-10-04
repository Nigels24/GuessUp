import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BADGES } from '../common/badges.js';
import { accuracyPercent } from '../common/game-rules.js';
import { CATEGORY_REF } from '../game/game.service.js';
import { buildProgress, type CategoryAccuracy, type TopicToReview } from '../me/me.progress.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { pageOf, type Page } from './dto/query.dto.js';
import type { StudentListQueryDto, UserStatusKey } from './dto/student.dto.js';

export const STUDENTS_PAGE_SIZE = 25;
export const STUDENT_NOT_FOUND = 'Student not found.';

export interface StudentRow {
  id: string;
  fullName: string;
  email: string;
  yearLevel: string | null;
  status: UserStatusKey;
  createdAt: Date;
  /** Completed rounds; points and accuracy count completed rounds only. */
  rounds: number;
  totalPoints: number;
  accuracy: number;
  /**
   * Latest activity of any kind: a round started or ended (also quit or still
   * in progress) or an answer submitted. Null when the student never played.
   */
  lastActive: Date | null;
}

export interface StudentDetail extends StudentRow {
  perCategory: CategoryAccuracy[];
  topicsToReview: TopicToReview[];
  badges: { code: string; icon: string; name: string; earnedAt: Date }[];
}

const STUDENT_FIELDS = {
  id: true,
  fullName: true,
  email: true,
  yearLevel: true,
  status: true,
  createdAt: true,
} as const;

/**
 * Student accounts (Admin Panel > Students). Administrator accounts are never
 * listed here and cannot be deactivated through these routes.
 */
@Injectable()
export class AdminStudentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Highest points first, as in the prototype; stats from completed rounds. */
  async list(query: StudentListQueryDto): Promise<Page<StudentRow>> {
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      role: 'STUDENT',
      yearLevel: query.yearLevel,
      status: query.status,
      OR: search
        ? [
            { fullName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const students = await this.prisma.user.findMany({ where, select: STUDENT_FIELDS });
    const stats = await this.stats(students.map((s) => s.id));

    const rows = students
      .map((s) => ({ ...s, ...(stats.get(s.id) ?? NO_STATS) }))
      .sort((a, b) => b.totalPoints - a.totalPoints || a.fullName.localeCompare(b.fullName));
    const { page, pageSize, skip, take } = pageOf(query, STUDENTS_PAGE_SIZE);
    return { items: rows.slice(skip, skip + take), total: rows.length, page, pageSize };
  }

  /** The prototype's student "View" dialog. */
  async get(id: string): Promise<StudentDetail> {
    const student = await this.prisma.user.findFirst({
      where: { id, role: 'STUDENT' },
      select: STUDENT_FIELDS,
    });
    if (!student) throw new NotFoundException(STUDENT_NOT_FOUND);

    const [categories, sessions, answers, badges, stats] = await Promise.all([
      this.prisma.category.findMany({
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: CATEGORY_REF,
      }),
      this.prisma.gameSession.findMany({
        where: { userId: id, status: 'COMPLETED' },
        select: { categoryId: true, totalScore: true, correctCount: true, totalItems: true },
      }),
      this.prisma.answer.findMany({
        where: { session: { userId: id, status: 'COMPLETED' } },
        select: { isCorrect: true, question: { select: { categoryId: true, topic: true } } },
      }),
      this.prisma.studentBadge.findMany({ where: { userId: id }, orderBy: { earnedAt: 'asc' } }),
      this.stats([id]),
    ]);

    const progress = buildProgress(
      categories,
      sessions,
      answers.map((a) => ({ isCorrect: a.isCorrect, ...a.question })),
      [],
    );
    return {
      ...student,
      ...(stats.get(id) ?? NO_STATS),
      perCategory: progress.perCategory,
      topicsToReview: progress.topicsToReview,
      badges: badges.flatMap((b) => {
        const badge = BADGES.find((x) => x.code === b.badgeCode);
        return badge ? [{ code: badge.code, icon: badge.icon, name: badge.name, earnedAt: b.earnedAt }] : [];
      }),
    };
  }

  /** Activate or deactivate. A deactivated student loses access on their next request. */
  async setStatus(id: string, status: UserStatusKey): Promise<StudentRow> {
    const updated = await this.prisma.user.updateMany({
      where: { id, role: 'STUDENT' },
      data: { status },
    });
    if (updated.count !== 1) throw new NotFoundException(STUDENT_NOT_FOUND);
    const student = await this.prisma.user.findUniqueOrThrow({ where: { id }, select: STUDENT_FIELDS });
    return { ...student, ...((await this.stats([id])).get(id) ?? NO_STATS) };
  }

  private async stats(userIds: string[]) {
    if (!userIds.length) return new Map<string, typeof NO_STATS>();
    const [completed, anyRound, lastAnswers] = await Promise.all([
      this.prisma.gameSession.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, status: 'COMPLETED' },
        _count: { _all: true },
        _sum: { totalScore: true, correctCount: true, totalItems: true },
      }),
      this.prisma.gameSession.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _max: { startedAt: true, endedAt: true },
      }),
      // Answers have no user column; their round tells whose they are.
      this.prisma.$queryRaw<{ userId: string; last: Date }[]>`
        SELECT s."userId" AS "userId", MAX(a."createdAt") AS "last"
        FROM "answers" a JOIN "game_sessions" s ON s."id" = a."sessionId"
        WHERE s."userId" IN (${Prisma.join(userIds)})
        GROUP BY s."userId"`,
    ]);

    const stats = new Map<string, typeof NO_STATS>();
    for (const g of anyRound) {
      const answered = lastAnswers.find((a) => a.userId === g.userId)?.last ?? null;
      const done = completed.find((c) => c.userId === g.userId);
      stats.set(g.userId, {
        rounds: done?._count._all ?? 0,
        totalPoints: done?._sum.totalScore ?? 0,
        accuracy: accuracyPercent(done?._sum.correctCount ?? 0, done?._sum.totalItems ?? 0),
        lastActive: latest(g._max.startedAt, g._max.endedAt, answered),
      });
    }
    return stats;
  }
}

/** The most recent of the given times, or null. */
export function latest(...times: (Date | null | undefined)[]): Date | null {
  return times.reduce<Date | null>((max, t) => (t && (!max || t > max) ? t : max), null);
}

const NO_STATS: { rounds: number; totalPoints: number; accuracy: number; lastActive: Date | null } = {
  rounds: 0,
  totalPoints: 0,
  accuracy: 0,
  lastActive: null,
};
