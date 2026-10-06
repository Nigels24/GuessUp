/**
 * Reads what the badge rules need for one student. Shared by
 * GameService.awardBadges (inside the finish transaction) and the
 * badges:backfill script, so both judge the same history the same way.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { badgeStats, type BadgeStats } from '../common/badges.js';

type Db = Prisma.TransactionClient | PrismaClient;

export async function loadBadgeStats(
  db: Db,
  userId: string,
): Promise<{ stats: BadgeStats; held: string[] }> {
  const [sessions, answers, log, active, held] = await Promise.all([
    db.gameSession.findMany({
      where: { userId, status: 'COMPLETED' },
      select: { categoryId: true, difficulty: true, accuracy: true, hintsUsed: true },
    }),
    db.answer.findMany({
      where: { session: { userId, status: 'COMPLETED' } },
      select: { isCorrect: true, timeTaken: true, session: { select: { categoryId: true } } },
    }),
    // Every answer, abandoned rounds included, in the order given (Hot Streak).
    db.answer.findMany({
      where: { session: { userId } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { isCorrect: true },
    }),
    // Playable now: what POST /game/sessions accepts.
    db.category.findMany({
      where: { questions: { some: { isActive: true } } },
      select: { id: true },
    }),
    db.studentBadge.findMany({ where: { userId }, select: { badgeCode: true } }),
  ]);
  return {
    stats: badgeStats(
      sessions,
      answers.map((a) => ({ categoryId: a.session.categoryId, isCorrect: a.isCorrect, timeTaken: a.timeTaken })),
      { answerLog: log.map((a) => a.isCorrect), activeCategoryIds: active.map((c) => c.id) },
    ),
    held: held.map((b) => b.badgeCode),
  };
}
