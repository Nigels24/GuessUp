import { Injectable } from '@nestjs/common';
import type { PublicUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildSummary, type MeSummary } from './me.summary.js';

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: PublicUser): Promise<MeSummary> {
    const [categories, sessions, badges] = await Promise.all([
      // Same order as GET /categories (seed order).
      this.prisma.category.findMany({
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true },
      }),
      this.prisma.gameSession.findMany({
        where: { userId: user.id, status: 'COMPLETED' },
        select: { categoryId: true, totalScore: true, correctCount: true, totalItems: true },
      }),
      this.prisma.studentBadge.findMany({
        where: { userId: user.id },
        select: { badgeCode: true, earnedAt: true },
      }),
    ]);
    return buildSummary(categories, sessions, badges);
  }
}
