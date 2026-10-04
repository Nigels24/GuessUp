import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CATEGORY_REF } from '../game/game.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { pageOf, type Page } from './dto/query.dto.js';
import type { SessionListQueryDto } from './dto/session.dto.js';
import { reportRange } from './reports.logic.js';

export const SESSIONS_PAGE_SIZE = 20;

const SESSION_INCLUDE = {
  user: { select: { id: true, fullName: true, email: true, yearLevel: true } },
  category: { select: CATEGORY_REF },
  _count: { select: { answers: true } },
} as const;

type SessionRow = Prisma.GameSessionGetPayload<{ include: typeof SESSION_INCLUDE }>;

function toRow(s: SessionRow) {
  return {
    id: s.id,
    user: s.user,
    category: s.category,
    difficulty: s.difficulty,
    status: s.status,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    totalScore: s.totalScore,
    correctCount: s.correctCount,
    totalItems: s.totalItems,
    accuracy: s.accuracy,
    timeSpent: s.timeSpent,
    hintsUsed: s.hintsUsed,
    /** Items answered so far (equals totalItems for a completed round). */
    answeredCount: s._count.answers,
  };
}

export type AdminSessionRow = ReturnType<typeof toRow>;

export interface AdminSessionDetail extends AdminSessionRow {
  answers: {
    index: number;
    question: {
      id: string;
      type: string;
      questionText: string;
      answer: string;
      topic: string | null;
    };
    submitted: string;
    isCorrect: boolean;
    hintUsed: boolean;
    timeTaken: number;
    pointsEarned: number;
    createdAt: Date;
  }[];
}

/** Recorded game sessions (Admin Panel > Game Sessions). Read only. */
@Injectable()
export class AdminSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Newest first. Dates filter on when the round started (Philippine calendar days). */
  async list(query: SessionListQueryDto): Promise<Page<AdminSessionRow>> {
    const search = query.search?.trim();
    let startedAt: Prisma.DateTimeFilter | undefined;
    if (query.from || query.to) {
      // Validates the dates; an open end stays open.
      const range = reportRange(query.from ?? query.to, query.to ?? query.from);
      startedAt = {
        gte: query.from ? range.start : undefined,
        lt: query.to ? range.end : undefined,
      };
    }
    const where: Prisma.GameSessionWhereInput = {
      userId: query.studentId || undefined,
      categoryId: query.categoryId || undefined,
      difficulty: query.difficulty,
      status: query.status,
      startedAt,
      user: search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
    };
    const { page, pageSize, skip, take } = pageOf(query, SESSIONS_PAGE_SIZE);
    const [total, rows] = await Promise.all([
      this.prisma.gameSession.count({ where }),
      this.prisma.gameSession.findMany({
        where,
        include: SESSION_INCLUDE,
        orderBy: [{ startedAt: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return { items: rows.map(toRow), total, page, pageSize };
  }

  /** One session with every submitted answer (the prototype's "Session answers"). */
  async get(id: string): Promise<AdminSessionDetail> {
    const session = await this.prisma.gameSession.findUnique({
      where: { id },
      include: {
        ...SESSION_INCLUDE,
        answers: {
          orderBy: { createdAt: 'asc' },
          include: {
            question: {
              select: { id: true, type: true, questionText: true, answer: true, topic: true },
            },
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Game session not found.');
    return {
      ...toRow(session),
      answers: session.answers.map((a, i) => ({
        index: i + 1,
        question: a.question,
        submitted: a.submitted,
        isCorrect: a.isCorrect,
        hintUsed: a.hintUsed,
        timeTaken: a.timeTaken,
        pointsEarned: a.pointsEarned,
        createdAt: a.createdAt,
      })),
    };
  }
}
