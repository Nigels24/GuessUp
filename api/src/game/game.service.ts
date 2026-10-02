import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { GameSession, Prisma } from '@prisma/client';
import type { PublicUser } from '../auth/auth.types.js';
import { badgeStats, evaluateBadges } from '../common/badges.js';
import { LEVELS, accuracyPercent } from '../common/game-rules.js';
import { LeaderboardService } from '../leaderboard/leaderboard.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { StartSessionDto } from './dto/start-session.dto.js';
import type { SubmitAnswerDto } from './dto/submit-answer.dto.js';
import { drawRound, hintFor, judgeAnswer, toItemDto, type GameQuestion } from './game.logic.js';
import type {
  AnswerResult,
  CategoryRef,
  FinishResult,
  HistoryEntry,
  RoundState,
  SessionResult,
  SessionSummary,
} from './game.types.js';

export const GAME_MESSAGES = {
  categoryNotFound: 'Category not found.',
  noQuestions: 'No questions available in this category yet.',
  sessionNotFound: 'Round not found.',
  notYourSession: 'This round belongs to another student.',
  roundOver: 'This round is already over.',
  allAnswered: 'Every item is answered. Finish the round to see your results.',
  alreadyAnswered: 'This item has already been answered.',
  notCurrentItem: 'That is not the current item of this round.',
  notServed: 'This item has not been sent yet. Load the current item first.',
  noHints: 'Hints are not allowed on this level.',
  hintUsed: 'You already used the hint for this item.',
  notAllAnswered: 'Answer every item before finishing the round.',
  notFinished: 'This round is not finished.',
  questionMissing: 'This question is no longer available.',
} as const;

const CATEGORY_REF = { id: true, slug: true, name: true, icon: true, color: true } as const;

const QUESTION_FIELDS = {
  id: true,
  type: true,
  difficulty: true,
  questionText: true,
  codeSnippet: true,
  imageUrl: true,
  answer: true,
  alternates: true,
  choices: true,
  hint: true,
  explanation: true,
} as const;

type SessionWithCategory = GameSession & { category: CategoryRef };

/**
 * Server-authoritative gameplay (Chapter III: game logic and scoring reside in
 * the application layer). The app only ever receives the item being played;
 * answers, points and the timer are decided here. Every request is treated as
 * hostile: ownership, round state and item index are checked on each call, and
 * state changes use conditional updates so a replayed or concurrent request
 * cannot score twice.
 */
@Injectable()
export class GameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leaderboard: LeaderboardService,
  ) {}

  /* ---------- POST /game/sessions ---------- */

  async start(user: PublicUser, dto: StartSessionDto): Promise<RoundState> {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: CATEGORY_REF,
    });
    if (!category) throw new NotFoundException(GAME_MESSAGES.categoryNotFound);

    const pool = await this.prisma.question.findMany({
      where: { categoryId: category.id, isActive: true },
      select: { id: true, difficulty: true },
    });
    const drawn = drawRound(pool, dto.difficulty);
    if (!drawn.length) throw new NotFoundException(GAME_MESSAGES.noQuestions);

    const session = await this.prisma.$transaction(async (tx) => {
      // One live round per student: any unfinished round is abandoned.
      await tx.gameSession.updateMany({
        where: { userId: user.id, status: 'IN_PROGRESS' },
        data: { status: 'ABANDONED', endedAt: new Date(), currentServedAt: null },
      });
      return tx.gameSession.create({
        data: {
          userId: user.id,
          categoryId: category.id,
          difficulty: dto.difficulty,
          totalItems: drawn.length,
          itemIds: drawn.map((q) => q.id),
          currentServedAt: new Date(),
        },
        include: { category: { select: CATEGORY_REF } },
      });
    });

    return this.roundState(session, []);
  }

  /* ---------- GET /game/sessions/:id/current ---------- */

  /**
   * Sends the next unanswered item and starts its clock the first time it is
   * sent. Calling it again for the same item returns that item with the time
   * left; it never restarts the clock.
   */
  async current(user: PublicUser, sessionId: string): Promise<RoundState> {
    let session = await this.playableSession(user, sessionId);
    if (!session.currentServedAt) {
      // Conditional, so two concurrent calls agree on one start time.
      await this.prisma.gameSession.updateMany({
        where: {
          id: session.id,
          status: 'IN_PROGRESS',
          currentIndex: session.currentIndex,
          currentServedAt: null,
        },
        data: { currentServedAt: new Date() },
      });
      session = await this.prisma.gameSession.findUniqueOrThrow({
        where: { id: session.id },
        include: { category: { select: CATEGORY_REF } },
      });
      if (session.status !== 'IN_PROGRESS') throw new ConflictException(GAME_MESSAGES.roundOver);
    }
    const answers = await this.prisma.answer.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      select: { isCorrect: true },
    });
    return this.roundState(
      session,
      answers.map((a) => a.isCorrect),
    );
  }

  /* ---------- POST /game/sessions/:id/hint ---------- */

  async hint(user: PublicUser, sessionId: string): Promise<{ hint: string }> {
    const session = await this.playableSession(user, sessionId);
    if (!session.currentServedAt) throw new ConflictException(GAME_MESSAGES.notServed);
    if (!LEVELS[session.difficulty].hints) throw new ForbiddenException(GAME_MESSAGES.noHints);
    if (session.currentHintUsed) throw new ForbiddenException(GAME_MESSAGES.hintUsed);

    // Conditional on the same item and an unused hint, so it cannot be applied twice
    // or land on the next item after a concurrent answer.
    const marked = await this.prisma.gameSession.updateMany({
      where: {
        id: session.id,
        status: 'IN_PROGRESS',
        currentIndex: session.currentIndex,
        currentServedAt: { not: null },
        currentHintUsed: false,
      },
      data: { currentHintUsed: true },
    });
    if (marked.count !== 1) throw new ForbiddenException(GAME_MESSAGES.hintUsed);

    return { hint: hintFor(await this.question(session.itemIds[session.currentIndex]!)) };
  }

  /* ---------- POST /game/sessions/:id/answers ---------- */

  async answer(user: PublicUser, sessionId: string, dto: SubmitAnswerDto): Promise<AnswerResult> {
    const session = await this.playableSession(user, sessionId);
    const expectedIndex = session.currentIndex + 1;
    if (dto.index !== expectedIndex) {
      throw new ConflictException(
        dto.index < expectedIndex ? GAME_MESSAGES.alreadyAnswered : GAME_MESSAGES.notCurrentItem,
      );
    }
    const servedAt = session.currentServedAt;
    if (!servedAt) throw new ConflictException(GAME_MESSAGES.notServed);

    const question = await this.question(session.itemIds[session.currentIndex]!);
    const now = new Date();
    const judgement = judgeAnswer({
      question,
      difficulty: session.difficulty,
      submitted: dto.submitted,
      elapsedMs: now.getTime() - servedAt.getTime(),
      hintUsed: session.currentHintUsed,
    });
    const isLastItem = expectedIndex === session.totalItems;

    const totals = await this.prisma.$transaction(async (tx) => {
      // Claim this item: only succeeds while it is still the current one.
      const claimed = await tx.gameSession.updateMany({
        where: { id: session.id, status: 'IN_PROGRESS', currentIndex: session.currentIndex },
        data: {
          currentIndex: { increment: 1 },
          totalScore: { increment: judgement.pointsEarned },
          currentHintUsed: false,
          // The next item's clock starts only when GET /current sends it, so time
          // spent reading the feedback and explanation is not counted.
          currentServedAt: null,
        },
      });
      if (claimed.count !== 1) throw new ConflictException(GAME_MESSAGES.alreadyAnswered);

      await tx.answer.create({
        data: {
          sessionId: session.id,
          questionId: question.id,
          submitted: judgement.submitted,
          isCorrect: judgement.isCorrect,
          hintUsed: session.currentHintUsed,
          timeTaken: judgement.timeTaken,
          pointsEarned: judgement.pointsEarned,
        },
      });
      const [updated, correctCount] = await Promise.all([
        tx.gameSession.findUniqueOrThrow({
          where: { id: session.id },
          select: { totalScore: true },
        }),
        tx.answer.count({ where: { sessionId: session.id, isCorrect: true } }),
      ]);
      return { totalScore: updated.totalScore, correctCount };
    });

    return {
      index: expectedIndex,
      isCorrect: judgement.isCorrect,
      timedOut: judgement.timedOut,
      // Revealed only now, after the answer, as in the prototype.
      correctAnswer: question.answer,
      explanation: question.explanation,
      pointsEarned: judgement.pointsEarned,
      totalScore: totals.totalScore,
      correctCount: totals.correctCount,
      answeredCount: expectedIndex,
      totalItems: session.totalItems,
      isLastItem,
    };
  }

  /* ---------- POST /game/sessions/:id/finish ---------- */

  async finish(user: PublicUser, sessionId: string): Promise<FinishResult> {
    const session = await this.ownSession(user, sessionId);
    if (session.status !== 'IN_PROGRESS') throw new ConflictException(GAME_MESSAGES.roundOver);
    if (session.currentIndex < session.totalItems) {
      throw new ConflictException(GAME_MESSAGES.notAllAnswered);
    }

    const newBadges = await this.prisma.$transaction(async (tx) => {
      const answers = await tx.answer.findMany({ where: { sessionId: session.id } });
      const correctCount = answers.filter((a) => a.isCorrect).length;
      const totalScore = answers.reduce((sum, a) => sum + a.pointsEarned, 0);

      // Conditional, so a double tap on "See results" cannot count the round twice.
      const completed = await tx.gameSession.updateMany({
        where: { id: session.id, status: 'IN_PROGRESS', currentIndex: session.totalItems },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(),
          totalScore,
          correctCount,
          accuracy: accuracyPercent(correctCount, session.totalItems),
          timeSpent: answers.reduce((sum, a) => sum + a.timeTaken, 0),
          hintsUsed: answers.filter((a) => a.hintUsed).length,
          currentServedAt: null,
        },
      });
      if (completed.count !== 1) throw new ConflictException(GAME_MESSAGES.roundOver);

      await tx.leaderboardEntry.upsert({
        where: { userId_categoryId: { userId: user.id, categoryId: session.categoryId } },
        create: {
          userId: user.id,
          categoryId: session.categoryId,
          totalPoints: totalScore,
          roundsPlayed: 1,
        },
        update: { totalPoints: { increment: totalScore }, roundsPlayed: { increment: 1 } },
      });

      return this.awardBadges(tx, user.id);
    });

    const result = await this.result(session.id);
    return {
      ...result,
      newBadges: newBadges.map(({ code, icon, name, description }) => ({
        code,
        icon,
        name,
        description,
      })),
    };
  }

  /* ---------- POST /game/sessions/:id/abandon ---------- */

  async abandon(
    user: PublicUser,
    sessionId: string,
  ): Promise<{ sessionId: string; status: 'ABANDONED' }> {
    const session = await this.ownSession(user, sessionId);
    const abandoned = await this.prisma.gameSession.updateMany({
      where: { id: session.id, status: 'IN_PROGRESS' },
      data: { status: 'ABANDONED', endedAt: new Date(), currentServedAt: null },
    });
    if (abandoned.count !== 1) throw new ConflictException(GAME_MESSAGES.roundOver);
    return { sessionId: session.id, status: 'ABANDONED' };
  }

  /* ---------- GET /game/sessions/:id ---------- */

  async get(user: PublicUser, sessionId: string): Promise<SessionResult> {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { userId: true, status: true },
    });
    if (!session) throw new NotFoundException(GAME_MESSAGES.sessionNotFound);
    if (user.role !== 'ADMIN' && session.userId !== user.id) {
      throw new ForbiddenException(GAME_MESSAGES.notYourSession);
    }
    if (session.status !== 'COMPLETED') throw new ConflictException(GAME_MESSAGES.notFinished);
    return this.result(sessionId);
  }

  /* ---------- GET /game/history ---------- */

  async history(user: PublicUser, limit: number): Promise<HistoryEntry[]> {
    const sessions = await this.prisma.gameSession.findMany({
      where: { userId: user.id, status: 'COMPLETED' },
      orderBy: { endedAt: 'desc' },
      take: limit,
      include: { category: { select: CATEGORY_REF } },
    });
    return sessions.map((s) => ({
      id: s.id,
      category: s.category,
      difficulty: s.difficulty,
      totalScore: s.totalScore,
      accuracy: s.accuracy,
      correctCount: s.correctCount,
      totalItems: s.totalItems,
      endedAt: s.endedAt,
    }));
  }

  /* ---------- helpers ---------- */

  /** The caller's own round, or 404 / 403. */
  private async ownSession(user: PublicUser, sessionId: string): Promise<SessionWithCategory> {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { category: { select: CATEGORY_REF } },
    });
    if (!session) throw new NotFoundException(GAME_MESSAGES.sessionNotFound);
    if (session.userId !== user.id) throw new ForbiddenException(GAME_MESSAGES.notYourSession);
    return session;
  }

  /** The caller's own round, still in progress and with an item left to answer. */
  private async playableSession(user: PublicUser, sessionId: string): Promise<SessionWithCategory> {
    const session = await this.ownSession(user, sessionId);
    if (session.status !== 'IN_PROGRESS') throw new ConflictException(GAME_MESSAGES.roundOver);
    if (session.currentIndex >= session.totalItems) {
      throw new ConflictException(GAME_MESSAGES.allAnswered);
    }
    return session;
  }

  private async question(id: string): Promise<GameQuestion> {
    const question = await this.prisma.question.findUnique({
      where: { id },
      select: QUESTION_FIELDS,
    });
    if (!question) throw new NotFoundException(GAME_MESSAGES.questionMissing);
    return question;
  }

  private async roundState(session: SessionWithCategory, results: boolean[]): Promise<RoundState> {
    const level = LEVELS[session.difficulty];
    const question = await this.question(session.itemIds[session.currentIndex]!);
    const servedAt = session.currentServedAt ?? new Date();
    const elapsed = (Date.now() - servedAt.getTime()) / 1000;
    return {
      sessionId: session.id,
      category: session.category,
      difficulty: session.difficulty,
      totalItems: session.totalItems,
      secondsPerItem: level.seconds,
      hintsAllowed: level.hints,
      hintPenalty: level.hintPenalty,
      totalScore: session.totalScore,
      results,
      secondsRemaining: Math.max(0, Math.round(level.seconds - elapsed)),
      hintUsed: session.currentHintUsed,
      hint: session.currentHintUsed ? hintFor(question) : null,
      item: toItemDto(question, session.currentIndex + 1),
    };
  }

  /** Evaluate badges from the student's completed rounds and store the new ones. */
  private async awardBadges(tx: Prisma.TransactionClient, userId: string) {
    const [sessions, answers, held] = await Promise.all([
      tx.gameSession.findMany({
        where: { userId, status: 'COMPLETED' },
        select: { categoryId: true, difficulty: true, accuracy: true, hintsUsed: true },
      }),
      tx.answer.findMany({
        where: { session: { userId, status: 'COMPLETED' } },
        select: { isCorrect: true, timeTaken: true },
      }),
      tx.studentBadge.findMany({ where: { userId }, select: { badgeCode: true } }),
    ]);
    const earned = evaluateBadges(
      badgeStats(sessions, answers),
      held.map((b) => b.badgeCode),
    );
    if (earned.length) {
      await tx.studentBadge.createMany({
        data: earned.map((b) => ({ userId, badgeCode: b.code })),
        skipDuplicates: true,
      });
    }
    return earned;
  }

  /** Summary, rank and review of a completed round (the Result screen). */
  private async result(sessionId: string): Promise<SessionResult> {
    const session = await this.prisma.gameSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: {
        category: { select: CATEGORY_REF },
        answers: {
          orderBy: { createdAt: 'asc' },
          include: {
            question: {
              select: { type: true, questionText: true, answer: true, explanation: true },
            },
          },
        },
      },
    });
    const { rank, totalPlayers } = await this.leaderboard.rankOf(
      session.categoryId,
      session.userId,
    );

    const summary: SessionSummary = {
      id: session.id,
      category: session.category,
      difficulty: session.difficulty,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      totalScore: session.totalScore,
      correctCount: session.correctCount,
      totalItems: session.totalItems,
      accuracy: session.accuracy,
      timeSpent: session.timeSpent,
      hintsUsed: session.hintsUsed,
    };

    return {
      session: summary,
      rankInCategory: rank,
      totalPlayersInCategory: totalPlayers,
      review: session.answers.map((a, i) => ({
        index: i + 1,
        type: a.question.type,
        questionText: a.question.questionText,
        submitted: a.submitted,
        correctAnswer: a.question.answer,
        explanation: a.question.explanation,
        isCorrect: a.isCorrect,
        timeTaken: a.timeTaken,
        hintUsed: a.hintUsed,
        pointsEarned: a.pointsEarned,
      })),
    };
  }
}
