import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { categoryCompletions, type CategoryCompletion, type LevelBest } from '../common/certificates.js';
import { CATEGORY_REF } from '../game/game.service.js';
import type { CategoryRef } from '../game/game.types.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const CERTIFICATE_NOT_FOUND = 'This student has not passed every level of this category yet.';

/** What the certificate rule reads from each finished round. */
const ROUND_FIELDS = {
  id: true,
  userId: true,
  categoryId: true,
  difficulty: true,
  status: true,
  correctCount: true,
  totalItems: true,
  totalScore: true,
  endedAt: true,
} as const;

const STUDENT_REF = { id: true, fullName: true, email: true, yearLevel: true } as const;

export interface CertificateStudent {
  id: string;
  fullName: string;
  email: string;
  yearLevel: string | null;
}

/** One earned certificate in a list. */
export interface CertificateRow {
  student: CertificateStudent;
  category: CategoryRef;
  completedAt: Date;
}

/** The printable certificate. */
export interface CertificateDetail extends CertificateRow {
  /** Best round per level, Easy → Difficult. */
  levels: LevelBest[];
}

/**
 * Category completion certificates (Admin Panel > Certificates, Student
 * detail). Derived from finished rounds (common/certificates.ts); nothing is
 * stored. Students only; administrators never appear.
 */
@Injectable()
export class AdminCertificatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every earned certificate, newest first; optionally one category only. */
  async list(categoryId?: string): Promise<CertificateRow[]> {
    const completions = await this.completions({ categoryId: categoryId || undefined });
    const rows = await this.withNames(completions);
    return rows.sort(
      (a, b) => b.completedAt.getTime() - a.completedAt.getTime() || a.student.fullName.localeCompare(b.student.fullName),
    );
  }

  /** One student's certificates, earliest first (Student detail). */
  async forStudent(studentId: string): Promise<CertificateRow[]> {
    return this.withNames(await this.completions({ userId: studentId }));
  }

  /** One certificate, with the best round per level; 404 when not (yet) earned. */
  async get(studentId: string, categoryId: string): Promise<CertificateDetail> {
    const [completion] = await this.completions({ userId: studentId, categoryId });
    if (!completion) throw new NotFoundException(CERTIFICATE_NOT_FOUND);
    const [row] = await this.withNames([completion]);
    if (!row) throw new NotFoundException(CERTIFICATE_NOT_FOUND);
    return { ...row, levels: completion.levels };
  }

  /** Completions of student accounts matching `where`, with whose they are. */
  private async completions(
    where: Prisma.GameSessionWhereInput,
  ): Promise<(CategoryCompletion & { userId: string })[]> {
    const rounds = await this.prisma.gameSession.findMany({
      where: { ...where, status: 'COMPLETED', user: { role: 'STUDENT' } },
      select: ROUND_FIELDS,
    });
    const byUser = new Map<string, typeof rounds>();
    for (const round of rounds) {
      const list = byUser.get(round.userId) ?? [];
      list.push(round);
      byUser.set(round.userId, list);
    }
    return [...byUser].flatMap(([userId, list]) => categoryCompletions(list).map((c) => ({ ...c, userId })));
  }

  private async withNames(completions: (CategoryCompletion & { userId: string })[]): Promise<CertificateRow[]> {
    if (!completions.length) return [];
    const [students, categories] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: [...new Set(completions.map((c) => c.userId))] } },
        select: STUDENT_REF,
      }),
      this.prisma.category.findMany({
        where: { id: { in: [...new Set(completions.map((c) => c.categoryId))] } },
        select: CATEGORY_REF,
      }),
    ]);
    return completions.flatMap((c) => {
      const student = students.find((s) => s.id === c.userId);
      const category = categories.find((x) => x.id === c.categoryId);
      return student && category ? [{ student, category, completedAt: c.completedAt }] : [];
    });
  }
}
