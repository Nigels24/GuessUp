import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthService, toPublicUser } from '../auth/auth.service.js';
import type { PublicUser } from '../auth/auth.types.js';
import { CATEGORY_REF, toHistoryEntry } from '../game/game.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import { buildProgress, type MeProgress } from './me.progress.js';
import { newPasswordProblem, profileProblem, samePasswordProblem } from './me.rules.js';
import { buildSummary, type MeSummary } from './me.summary.js';

/** Wording copied from the prototype's Change password dialog. */
export const ME_MESSAGES = {
  wrongPassword: 'Current password is incorrect.',
} as const;

/** How many rounds the progress score history lists, like the prototype. */
export const PROGRESS_HISTORY_SIZE = 20;

/** Completed rounds, the only ones that count toward progress. */
const COMPLETED_ROUND = { status: 'COMPLETED' } as const;

const SESSION_TOTALS = {
  categoryId: true,
  totalScore: true,
  correctCount: true,
  totalItems: true,
} as const;

/** Same order as GET /categories (seed order). */
const CATEGORY_ORDER = [{ createdAt: 'asc' }, { id: 'asc' }] as const;

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async summary(user: PublicUser): Promise<MeSummary> {
    const [categories, sessions, badges] = await Promise.all([
      this.prisma.category.findMany({
        orderBy: [...CATEGORY_ORDER],
        select: { id: true, name: true },
      }),
      this.prisma.gameSession.findMany({
        where: { userId: user.id, ...COMPLETED_ROUND },
        select: SESSION_TOTALS,
      }),
      this.prisma.studentBadge.findMany({
        where: { userId: user.id },
        select: { badgeCode: true, earnedAt: true },
      }),
    ]);
    return buildSummary(categories, sessions, badges);
  }

  async progress(user: PublicUser): Promise<MeProgress> {
    const [categories, sessions, answers, latest] = await Promise.all([
      this.prisma.category.findMany({ orderBy: [...CATEGORY_ORDER], select: CATEGORY_REF }),
      this.prisma.gameSession.findMany({
        where: { userId: user.id, ...COMPLETED_ROUND },
        select: SESSION_TOTALS,
      }),
      this.prisma.answer.findMany({
        where: { session: { userId: user.id, ...COMPLETED_ROUND } },
        select: { isCorrect: true, question: { select: { categoryId: true, topic: true } } },
      }),
      this.prisma.gameSession.findMany({
        where: { userId: user.id, ...COMPLETED_ROUND },
        orderBy: { endedAt: 'desc' },
        take: PROGRESS_HISTORY_SIZE,
        include: { category: { select: CATEGORY_REF } },
      }),
    ]);
    return buildProgress(
      categories,
      sessions,
      answers.map((a) => ({ isCorrect: a.isCorrect, ...a.question })),
      latest.map(toHistoryEntry),
    );
  }

  /** The prototype's Edit profile. Returns the updated user. */
  /** Students: full name and year level. Administrators (the panel's My account): full name. */
  async updateProfile(user: PublicUser, dto: UpdateProfileDto): Promise<PublicUser> {
    const problem = profileProblem(user.role, dto);
    if (problem) throw new BadRequestException(problem);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { fullName: dto.fullName, yearLevel: dto.yearLevel },
    });
    return toPublicUser(updated);
  }

  /**
   * The prototype's Change password. A wrong current password is a 400, not a
   * 401: the apps sign the user out on any 401.
   */
  /** Any role. Administrators need 10+ characters and a password different from the current one. */
  async changePassword(user: PublicUser, dto: ChangePasswordDto): Promise<void> {
    const tooShort = newPasswordProblem(user.role, dto.newPassword);
    if (tooShort) throw new BadRequestException(tooShort);
    const { passwordHash } = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!(await this.auth.verifyPassword(dto.currentPassword, passwordHash))) {
      throw new BadRequestException(ME_MESSAGES.wrongPassword);
    }
    const same = samePasswordProblem(user.role, dto.currentPassword, dto.newPassword);
    if (same) throw new BadRequestException(same);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await this.auth.hashPassword(dto.newPassword) },
    });
  }
}
