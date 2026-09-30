import { Injectable } from '@nestjs/common';
import { accuracyPercent } from '../common/game-rules.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface RankingRow {
  rank: number;
  userId: string;
  fullName: string;
  totalPoints: number;
  roundsPlayed: number;
  /** Correct items / items played across the student's completed rounds here. */
  accuracy: number;
}

/**
 * Per-category rankings (the prototype's leaderboard): active students only,
 * ordered by total points, then accuracy. The leaderboard endpoints come in a
 * later step; for now the finish endpoint uses this to report the rank.
 */
@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async categoryRanking(categoryId: string): Promise<RankingRow[]> {
    const [entries, totals] = await Promise.all([
      this.prisma.leaderboardEntry.findMany({
        where: { categoryId, user: { role: 'STUDENT', status: 'ACTIVE' } },
        select: {
          totalPoints: true,
          roundsPlayed: true,
          user: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.gameSession.groupBy({
        by: ['userId'],
        where: { categoryId, status: 'COMPLETED' },
        _sum: { correctCount: true, totalItems: true },
      }),
    ]);

    const totalsByUser = new Map(totals.map((t) => [t.userId, t._sum]));
    return entries
      .map((entry) => {
        const sums = totalsByUser.get(entry.user.id);
        return {
          userId: entry.user.id,
          fullName: entry.user.fullName,
          totalPoints: entry.totalPoints,
          roundsPlayed: entry.roundsPlayed,
          accuracy: accuracyPercent(sums?.correctCount ?? 0, sums?.totalItems ?? 0),
        };
      })
      .sort(
        (a, b) =>
          b.totalPoints - a.totalPoints ||
          b.accuracy - a.accuracy ||
          a.fullName.localeCompare(b.fullName),
      )
      .map((row, i) => ({ rank: i + 1, ...row }));
  }

  /** The student's rank in a category (null when not ranked) and the number of ranked players. */
  async rankOf(
    categoryId: string,
    userId: string,
  ): Promise<{ rank: number | null; totalPlayers: number }> {
    const ranking = await this.categoryRanking(categoryId);
    const mine = ranking.find((row) => row.userId === userId);
    return { rank: mine?.rank ?? null, totalPlayers: ranking.length };
  }
}
