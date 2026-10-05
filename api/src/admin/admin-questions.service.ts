import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Question } from '@prisma/client';
import { CATEGORY_REF } from '../game/game.service.js';
import type { CategoryRef } from '../game/game.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import type {
  CreateQuestionDto,
  QuestionListQueryDto,
  UpdateQuestionDto,
} from './dto/question.dto.js';
import { pageOf, type Page } from './dto/query.dto.js';
import { checkQuestion, type QuestionInput } from './question.rules.js';

export const QUESTIONS_PAGE_SIZE = 15;

export const QUESTION_ADMIN_MESSAGES = {
  notFound: 'Question not found.',
  categoryMissing: 'Choose a subject category.',
  deleted: 'Question deleted.',
} as const;

/** A question as the Admin Panel sees it: every field, answer included. */
export interface AdminQuestion {
  id: string;
  seedKey: string | null;
  category: CategoryRef;
  type: Question['type'];
  difficulty: Question['difficulty'];
  questionText: string;
  codeSnippet: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  answer: string;
  alternates: string[];
  choices: string[];
  hint: string | null;
  explanation: string;
  topic: string | null;
  isActive: boolean;
  /** Recorded answers; a question with answers is deactivated instead of deleted. */
  answerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeleteResult {
  outcome: 'DELETED' | 'DEACTIVATED';
  message: string;
}

const INCLUDE = {
  category: { select: CATEGORY_REF },
  _count: { select: { answers: true } },
} as const;

type QuestionRow = Question & { category: CategoryRef; _count: { answers: number } };

function toAdminQuestion(q: QuestionRow): AdminQuestion {
  return {
    id: q.id,
    seedKey: q.seedKey,
    category: q.category,
    type: q.type,
    difficulty: q.difficulty,
    questionText: q.questionText,
    codeSnippet: q.codeSnippet,
    imageUrl: q.imageUrl,
    imagePublicId: q.imagePublicId,
    answer: q.answer,
    alternates: q.alternates,
    choices: q.choices,
    hint: q.hint,
    explanation: q.explanation,
    topic: q.topic,
    isActive: q.isActive,
    answerCount: q._count.answers,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  };
}

/** The question bank (Admin Panel > Question Bank). */
@Injectable()
export class AdminQuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async list(query: QuestionListQueryDto): Promise<Page<AdminQuestion>> {
    const search = query.search?.trim();
    const where: Prisma.QuestionWhereInput = {
      categoryId: query.categoryId || undefined,
      difficulty: query.difficulty,
      type: query.type,
      isActive: query.active === undefined ? undefined : query.active === 'true',
      OR: search
        ? [
            { questionText: { contains: search, mode: 'insensitive' } },
            { answer: { contains: search, mode: 'insensitive' } },
            { topic: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const { page, pageSize, skip, take } = pageOf(query, QUESTIONS_PAGE_SIZE);
    const [total, rows] = await Promise.all([
      this.prisma.question.count({ where }),
      this.prisma.question.findMany({
        where,
        include: INCLUDE,
        // Items added in the panel first (newest first), then the seeded bank in key order.
        orderBy: [{ seedKey: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return { items: rows.map(toAdminQuestion), total, page, pageSize };
  }

  async get(id: string): Promise<AdminQuestion> {
    const row = await this.prisma.question.findUnique({ where: { id }, include: INCLUDE });
    if (!row) throw new NotFoundException(QUESTION_ADMIN_MESSAGES.notFound);
    return toAdminQuestion(row);
  }

  async create(dto: CreateQuestionDto): Promise<AdminQuestion> {
    const data = await this.validated(dto);
    const created = await this.prisma.question.create({ data, include: INCLUDE });
    return toAdminQuestion(created);
  }

  /** Partial update: the stored item merged with the changes is checked as a whole. */
  async update(id: string, dto: UpdateQuestionDto): Promise<AdminQuestion> {
    const existing = await this.prisma.question.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(QUESTION_ADMIN_MESSAGES.notFound);

    const merged: QuestionInput = {
      categoryId: dto.categoryId ?? existing.categoryId,
      type: dto.type ?? existing.type,
      difficulty: dto.difficulty ?? existing.difficulty,
      questionText: dto.questionText ?? existing.questionText,
      codeSnippet: dto.codeSnippet !== undefined ? dto.codeSnippet : existing.codeSnippet,
      imageUrl: dto.imageUrl !== undefined ? dto.imageUrl : existing.imageUrl,
      imagePublicId: dto.imagePublicId !== undefined ? dto.imagePublicId : existing.imagePublicId,
      answer: dto.answer ?? existing.answer,
      alternates: dto.alternates ?? existing.alternates,
      choices: dto.choices ?? existing.choices,
      hint: dto.hint !== undefined ? dto.hint : existing.hint,
      explanation: dto.explanation ?? existing.explanation,
      topic: dto.topic !== undefined ? dto.topic : existing.topic,
      isActive: dto.isActive ?? existing.isActive,
    };
    // A new image URL without a public id is not a Cloudinary upload (e.g. a seeded /static picture).
    if (dto.imageUrl !== undefined && dto.imagePublicId === undefined && dto.imageUrl !== existing.imageUrl) {
      merged.imagePublicId = null;
    }
    const data = await this.validated(merged);

    const updated = await this.prisma.question.update({ where: { id }, data, include: INCLUDE });
    if (existing.imagePublicId && existing.imagePublicId !== updated.imagePublicId) {
      await this.removeImageIfUnused(existing.imagePublicId);
    }
    return toAdminQuestion(updated);
  }

  async setActive(id: string, isActive: boolean): Promise<AdminQuestion> {
    const updated = await this.prisma.question.updateMany({ where: { id }, data: { isActive } });
    if (updated.count !== 1) throw new NotFoundException(QUESTION_ADMIN_MESSAGES.notFound);
    return this.get(id);
  }

  /**
   * Deletes a question nobody has answered. A question with recorded answers
   * (Answer has no cascade, and reports need them) or one drawn into a round
   * being played right now is deactivated instead, and the result says so.
   */
  async remove(id: string): Promise<DeleteResult> {
    const question = await this.prisma.question.findUnique({
      where: { id },
      select: { id: true, imagePublicId: true, _count: { select: { answers: true } } },
    });
    if (!question) throw new NotFoundException(QUESTION_ADMIN_MESSAGES.notFound);

    const answers = question._count.answers;
    if (answers) return this.deactivate(id, deactivatedBecauseAnswered(answers));
    if (await this.inLiveRound(id)) return this.deactivate(id, DEACTIVATED_IN_ROUND);

    try {
      await this.prisma.question.delete({ where: { id } });
    } catch (error) {
      // An answer was recorded between the check and the delete (foreign key).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        return this.deactivate(id, deactivatedBecauseAnswered(1));
      }
      throw error;
    }
    await this.removeImageIfUnused(question.imagePublicId);
    return { outcome: 'DELETED', message: QUESTION_ADMIN_MESSAGES.deleted };
  }

  /** Is a Cloudinary image still used by any question? (Used by the uploads route too.) */
  async imageInUse(publicId: string): Promise<boolean> {
    return (await this.prisma.question.count({ where: { imagePublicId: publicId } })) > 0;
  }

  /* ---------- helpers ---------- */

  private async validated(input: QuestionInput) {
    const { data, errors } = checkQuestion(input);
    const category = await this.prisma.category.findUnique({
      where: { id: data.categoryId },
      select: { id: true },
    });
    if (!category) errors.unshift(QUESTION_ADMIN_MESSAGES.categoryMissing);
    if (errors.length) throw new BadRequestException(errors);
    return data;
  }

  private async inLiveRound(id: string): Promise<boolean> {
    const live = await this.prisma.gameSession.count({
      where: { status: 'IN_PROGRESS', itemIds: { has: id } },
    });
    return live > 0;
  }

  private async deactivate(id: string, message: string): Promise<DeleteResult> {
    await this.prisma.question.update({ where: { id }, data: { isActive: false } });
    return { outcome: 'DEACTIVATED', message };
  }

  private async removeImageIfUnused(publicId: string | null): Promise<void> {
    if (publicId && !(await this.imageInUse(publicId))) await this.cloudinary.destroy(publicId, 'questions');
  }
}

const DEACTIVATED_IN_ROUND =
  'A student is playing a round with this question right now, so it was deactivated instead of deleted. It is no longer drawn into new rounds.';

function deactivatedBecauseAnswered(answers: number): string {
  return `This question has ${answers} recorded answer${answers === 1 ? '' : 's'}, so it was deactivated instead of deleted to keep reports accurate. It is no longer drawn into new rounds.`;
}
