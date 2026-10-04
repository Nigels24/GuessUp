import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { DifficultyKey } from '../common/game-rules.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CATEGORY_MESSAGES,
  deleteBlockedMessage,
  isEmoji,
  normalizeColor,
  slugify,
} from './category.rules.js';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';
import { DIFFICULTIES } from './reports.logic.js';

export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  /** All questions, active or not. */
  questionCount: number;
  activeQuestionCount: number;
  /** Per difficulty: all questions and the active ones. */
  byDifficulty: Record<DifficultyKey, { total: number; active: number }>;
  /** Recorded game sessions (any status). */
  sessionCount: number;
}

/** Subject categories: create, update, delete (Admin Panel > Categories). */
@Injectable()
export class AdminCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminCategory[]> {
    const [categories, questionGroups, sessionGroups] = await Promise.all([
      this.prisma.category.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
      this.prisma.question.groupBy({
        by: ['categoryId', 'difficulty', 'isActive'],
        _count: { _all: true },
      }),
      this.prisma.gameSession.groupBy({ by: ['categoryId'], _count: { _all: true } }),
    ]);

    return categories.map((c) => {
      const byDifficulty = Object.fromEntries(
        DIFFICULTIES.map((d) => [d, { total: 0, active: 0 }]),
      ) as AdminCategory['byDifficulty'];
      for (const g of questionGroups.filter((g) => g.categoryId === c.id)) {
        byDifficulty[g.difficulty].total += g._count._all;
        if (g.isActive) byDifficulty[g.difficulty].active += g._count._all;
      }
      const levels = Object.values(byDifficulty);
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        icon: c.icon,
        color: c.color,
        description: c.description,
        questionCount: levels.reduce((sum, l) => sum + l.total, 0),
        activeQuestionCount: levels.reduce((sum, l) => sum + l.active, 0),
        byDifficulty,
        sessionCount: sessionGroups.find((g) => g.categoryId === c.id)?._count._all ?? 0,
      };
    });
  }

  async create(dto: CreateCategoryDto): Promise<AdminCategory> {
    const slug = dto.slug || slugify(dto.name);
    if (!slug) throw new BadRequestException(CATEGORY_MESSAGES.slugFromName);
    if (!isEmoji(dto.icon)) throw new BadRequestException(CATEGORY_MESSAGES.iconInvalid);
    await this.assertUnique(dto.name, slug);

    const created = await this.save(() =>
      this.prisma.category.create({
        data: {
          slug,
          name: dto.name,
          icon: dto.icon,
          color: normalizeColor(dto.color),
          description: dto.description,
        },
      }),
    );
    return this.one(created.id);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<AdminCategory> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(CATEGORY_MESSAGES.notFound);
    if (dto.icon !== undefined && !isEmoji(dto.icon)) {
      throw new BadRequestException(CATEGORY_MESSAGES.iconInvalid);
    }
    if (dto.name !== undefined) await this.assertUnique(dto.name, null, id);

    await this.save(() =>
      this.prisma.category.update({
        where: { id },
        data: {
          name: dto.name,
          icon: dto.icon,
          color: dto.color === undefined ? undefined : normalizeColor(dto.color),
          description: dto.description,
        },
      }),
    );
    return this.one(id);
  }

  /**
   * Refused (409) while the category has questions or recorded game sessions:
   * questions and rounds point to it, and reports must stay accurate.
   */
  async remove(id: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { questions: true, sessions: true } } },
    });
    if (!category) throw new NotFoundException(CATEGORY_MESSAGES.notFound);

    const blocked = deleteBlockedMessage(category.name, category._count);
    if (blocked) throw new ConflictException(blocked);

    try {
      // Leaderboard rows cascade; a session or question created meanwhile makes this fail.
      await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException(
          `${category.name} is now in use by a question or a game session and cannot be deleted.`,
        );
      }
      throw error;
    }
  }

  /* ---------- helpers ---------- */

  private async one(id: string): Promise<AdminCategory> {
    const row = (await this.list()).find((c) => c.id === id);
    if (!row) throw new NotFoundException(CATEGORY_MESSAGES.notFound);
    return row;
  }

  /** Names are unique ignoring case; slugs exactly. */
  private async assertUnique(name: string, slug: string | null, exceptId?: string): Promise<void> {
    const notSelf = exceptId ? { id: { not: exceptId } } : {};
    const sameName = await this.prisma.category.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, ...notSelf },
      select: { id: true },
    });
    if (sameName) throw new ConflictException(CATEGORY_MESSAGES.nameTaken);
    if (slug) {
      const sameSlug = await this.prisma.category.findFirst({
        where: { slug, ...notSelf },
        select: { id: true },
      });
      if (sameSlug) throw new ConflictException(CATEGORY_MESSAGES.slugTaken);
    }
  }

  /** A unique-constraint race (two admins saving the same name) is a 409, not a 500. */
  private async save<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = String(error.meta?.target ?? '');
        throw new ConflictException(
          target.includes('slug') ? CATEGORY_MESSAGES.slugTaken : CATEGORY_MESSAGES.nameTaken,
        );
      }
      throw error;
    }
  }
}
