import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { App } from 'supertest/types';
import { ANSWER_GRACE_SECONDS, LEVELS, ROUND_SIZE, scoreAnswer } from './../src/common/game-rules.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { allKeys, createApp, createTestAccount, deleteTestAccounts, type TestAccount } from './helpers.js';

/**
 * End-to-end gameplay: a full round played against the real API and database.
 * Two throwaway students play, so the seeded demo account is left untouched
 * and first_round is deterministic; everything they create is deleted after.
 *   npm run test:e2e
 */

/** Must never appear in a response before the student has answered. */
const ANSWER_KEYS = ['answer', 'alternates', 'explanation', 'correctAnswer'];
/** The item itself must not carry the hint either. */
const ITEM_FORBIDDEN = [...ANSWER_KEYS, 'hint', 'id'];

function expectNoAnswerFields(body: unknown): void {
  const keys = allKeys(body);
  for (const key of ANSWER_KEYS) expect(keys, `response leaks "${key}"`).not.toContain(key);
}

function expectSafeItem(item: unknown): void {
  const keys = Object.keys(item as object);
  for (const key of ITEM_FORBIDDEN) expect(keys, `item leaks "${key}"`).not.toContain(key);
}

const WRONG = 'definitely not the answer';
/** Seconds the tests pretend the student took on an item (rewinds the server timestamp). */
const THINK_SECONDS = 10;

describe('Gameplay (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let prisma: PrismaService;
  const stamp = Date.now();
  const emails = [`e2e-game-a-${stamp}@example.com`, `e2e-game-b-${stamp}@example.com`];
  let tokenA: string;
  let tokenB: string;
  let adminToken: string;
  let adminAccount: TestAccount | undefined;
  let progId: string;
  /** Student A's completed round, for the summary test. */
  let roundA: { total: number; correct: number };

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** The questions of a round in play order, read straight from the database. */
  async function roundQuestions(sessionId: string) {
    const session = await prisma.gameSession.findUniqueOrThrow({ where: { id: sessionId } });
    const questions = await prisma.question.findMany({ where: { id: { in: session.itemIds } } });
    return session.itemIds.map((id) => questions.find((q) => q.id === id)!);
  }

  /** Make the server believe the current item was sent `seconds` ago. */
  async function rewindClock(sessionId: string, seconds: number): Promise<void> {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { currentServedAt: new Date(Date.now() - seconds * 1000) },
    });
  }

  beforeAll(async () => {
    app = await createApp();
    http = app.getHttpServer() as App;
    prisma = app.get(PrismaService);

    const tokens: string[] = [];
    for (const email of emails) {
      const res = await request(http)
        .post('/api/auth/register')
        .send({ fullName: 'e2e-player', email, password: 'longenough', yearLevel: '2nd Year' })
        .expect(201);
      tokens.push(res.body.accessToken);
    }
    [tokenA, tokenB] = tokens as [string, string];

    adminAccount = await createTestAccount(prisma, 'ADMIN', 'game-admin');
    const admin = await request(http)
      .post('/api/auth/login')
      .send({ email: adminAccount.email, password: adminAccount.password })
      .expect(200);
    adminToken = admin.body.accessToken;
  });

  afterAll(async () => {
    if (prisma) {
      // Answers cascade with their session; leaderboard rows and badges with the user.
      // The empty category is deleted by its own test; this catches it if that test stopped early.
      await deleteTestAccounts(prisma, [...emails, ...(adminAccount ? [adminAccount.email] : [])]);
      await prisma.category.deleteMany({ where: { slug: `e2e-empty-${stamp}`, questions: { none: {} }, sessions: { none: {} } } });
    }
    await app?.close();
  }, 60_000);

  it('GET /api/categories lists the 7 categories with their active question counts', async () => {
    const res = await request(http).get('/api/categories').set(auth(tokenA)).expect(200);
    expect(res.body).toHaveLength(7);
    const prog = res.body.find((c: { slug: string }) => c.slug === 'prog');
    expect(prog).toMatchObject({ name: expect.any(String), icon: expect.any(String) });
    expect(prog.activeQuestionCount).toBe(15);
    expectNoAnswerFields(res.body);
    progId = prog.id;

    await request(http).get('/api/categories').expect(401);
  });

  it('plays a full round: start, answer 5 (correct, wrong, hint), finish', async () => {
    const level = LEVELS.EASY;

    // Start
    const start = await request(http)
      .post('/api/game/sessions')
      .set(auth(tokenA))
      .send({ categoryId: progId, difficulty: 'EASY' })
      .expect(201);
    expectNoAnswerFields(start.body);
    expectSafeItem(start.body.item);
    expect(start.body).toMatchObject({
      totalItems: ROUND_SIZE,
      difficulty: 'EASY',
      secondsPerItem: level.seconds,
      hintsAllowed: level.hints,
      totalScore: 0,
      results: [],
      hintUsed: false,
      hint: null,
    });
    expect(start.body.item.index).toBe(1);
    const sessionId: string = start.body.sessionId;
    const questions = await roundQuestions(sessionId);
    expect(questions.every((q) => q.difficulty === 'EASY')).toBe(true);

    // Plan: 1 correct, 2 wrong, 3 correct with hint, 4 correct, 5 wrong.
    const plan = [
      { correct: true, hint: false },
      { correct: false, hint: false },
      { correct: true, hint: true },
      { correct: true, hint: false },
      { correct: false, hint: false },
    ];
    let expectedTotal = 0;

    for (const [i, step] of plan.entries()) {
      const index = i + 1;
      const question = questions[i]!;

      if (index === 2) {
        // Item 2 has not been sent yet: no clock, so no answer or hint.
        const unsent = await request(http)
          .post(`/api/game/sessions/${sessionId}/answers`)
          .set(auth(tokenA))
          .send({ index: 2, submitted: question.answer })
          .expect(409);
        expect(unsent.body.message).toBe(
          'This item has not been sent yet. Load the current item first.',
        );
        await request(http).post(`/api/game/sessions/${sessionId}/hint`).set(auth(tokenA)).expect(409);
        await request(http).post(`/api/game/sessions/${sessionId}/finish`).set(auth(tokenA)).expect(409);

        const replay = await request(http)
          .post(`/api/game/sessions/${sessionId}/answers`)
          .set(auth(tokenA))
          .send({ index: 1, submitted: questions[0]!.answer })
          .expect(409);
        expect(replay.body.message).toBe('This item has already been answered.');
      }

      if (index > 1) {
        // The app asks for the next item after the feedback; this starts its clock.
        const current = await request(http)
          .get(`/api/game/sessions/${sessionId}/current`)
          .set(auth(tokenA))
          .expect(200);
        expectNoAnswerFields(current.body);
        expectSafeItem(current.body.item);
        expect(current.body.item.index).toBe(index);
        expect(current.body.item.questionText).toBe(question.questionText);
        expect(current.body.results).toHaveLength(index - 1);
        // Full time, give or take a second of network latency.
        expect(current.body.secondsRemaining).toBeGreaterThanOrEqual(level.seconds - 1);
        const served = await prisma.gameSession.findUniqueOrThrow({ where: { id: sessionId } });
        expect(served.currentServedAt).not.toBeNull();

        if (index === 2) {
          expect(current.body.results).toEqual([true]);
          // Asking again (app restarted) returns the same item and does not restart the clock.
          await rewindClock(sessionId, 7);
          const again = await request(http)
            .get(`/api/game/sessions/${sessionId}/current`)
            .set(auth(tokenA))
            .expect(200);
          expect(again.body.item.index).toBe(2);
          expect(again.body.item.questionText).toBe(question.questionText);
          expect(again.body.secondsRemaining).toBeLessThanOrEqual(level.seconds - 7);
          expect(again.body.secondsRemaining).toBeGreaterThanOrEqual(level.seconds - 8);
        }
      }

      if (step.hint) {
        const hint = await request(http)
          .post(`/api/game/sessions/${sessionId}/hint`)
          .set(auth(tokenA))
          .expect(200);
        expect(hint.body).toEqual({ hint: question.hint });
        await request(http).post(`/api/game/sessions/${sessionId}/hint`).set(auth(tokenA)).expect(403);
      }

      await rewindClock(sessionId, THINK_SECONDS);
      const res = await request(http)
        .post(`/api/game/sessions/${sessionId}/answers`)
        .set(auth(tokenA))
        .send({ index, submitted: step.correct ? question.answer : WRONG })
        .expect(200);

      const expectedPoints = scoreAnswer('EASY', step.correct, level.seconds - THINK_SECONDS, step.hint);
      expectedTotal += expectedPoints;
      expect(res.body).toEqual({
        index,
        isCorrect: step.correct,
        timedOut: false,
        correctAnswer: question.answer,
        explanation: question.explanation,
        pointsEarned: expectedPoints,
        totalScore: expectedTotal,
        correctCount: plan.slice(0, index).filter((p) => p.correct).length,
        answeredCount: index,
        totalItems: ROUND_SIZE,
        isLastItem: index === ROUND_SIZE,
      });

      // Answering stops the clock; the next item's clock waits for GET /current.
      const after = await prisma.gameSession.findUniqueOrThrow({ where: { id: sessionId } });
      expect(after.currentServedAt).toBeNull();
    }

    // Stored answers match scoreAnswer's output.
    const stored = await prisma.answer.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } });
    expect(stored.map((a) => a.pointsEarned)).toEqual(
      plan.map((p) => scoreAnswer('EASY', p.correct, level.seconds - THINK_SECONDS, p.hint)),
    );
    expect(stored.map((a) => a.hintUsed)).toEqual(plan.map((p) => p.hint));

    // Nothing left to send once every item is answered.
    await request(http).get(`/api/game/sessions/${sessionId}/current`).set(auth(tokenA)).expect(409);

    // Replaying the last item after the round is fully answered.
    await request(http)
      .post(`/api/game/sessions/${sessionId}/answers`)
      .set(auth(tokenA))
      .send({ index: ROUND_SIZE, submitted: questions[ROUND_SIZE - 1]!.answer })
      .expect(409);

    // Finish
    const finish = await request(http)
      .post(`/api/game/sessions/${sessionId}/finish`)
      .set(auth(tokenA))
      .expect(200);
    expect(finish.body.session).toMatchObject({
      id: sessionId,
      status: 'COMPLETED',
      totalScore: expectedTotal,
      correctCount: 3,
      totalItems: ROUND_SIZE,
      accuracy: 60,
      hintsUsed: 1,
      timeSpent: ROUND_SIZE * THINK_SECONDS,
    });
    expect(finish.body.newBadges.map((b: { code: string }) => b.code)).toContain('first_round');
    roundA = { total: expectedTotal, correct: 3 };
    expect(finish.body.rankInCategory).toBeGreaterThanOrEqual(1);
    expect(finish.body.totalPlayersInCategory).toBeGreaterThanOrEqual(finish.body.rankInCategory);
    expect(finish.body.review).toHaveLength(ROUND_SIZE);
    expect(finish.body.review.map((r: { explanation: string }) => r.explanation)).toEqual(
      questions.map((q) => q.explanation),
    );
    expect(finish.body.review[2]).toMatchObject({ hintUsed: true, isCorrect: true });

    // Leaderboard entry with the right totals, and the badge stored.
    const entry = await prisma.leaderboardEntry.findFirstOrThrow({
      where: { user: { email: emails[0] }, categoryId: progId },
    });
    expect(entry).toMatchObject({ totalPoints: expectedTotal, roundsPlayed: 1 });
    const badges = await prisma.studentBadge.findMany({ where: { user: { email: emails[0] } } });
    expect(badges.map((b) => b.badgeCode)).toContain('first_round');

    // Finishing twice does not count the round twice.
    await request(http).post(`/api/game/sessions/${sessionId}/finish`).set(auth(tokenA)).expect(409);
    const again = await prisma.leaderboardEntry.findFirstOrThrow({
      where: { user: { email: emails[0] }, categoryId: progId },
    });
    expect(again.roundsPlayed).toBe(1);

    // Reading the round: owner and admin yes, another student no.
    const own = await request(http).get(`/api/game/sessions/${sessionId}`).set(auth(tokenA)).expect(200);
    expect(own.body.review).toHaveLength(ROUND_SIZE);
    await request(http).get(`/api/game/sessions/${sessionId}`).set(auth(adminToken)).expect(200);
    const other = await request(http)
      .get(`/api/game/sessions/${sessionId}`)
      .set(auth(tokenB))
      .expect(403);
    expect(other.body.message).toBe('This round belongs to another student.');
    await request(http)
      .post(`/api/game/sessions/${sessionId}/abandon`)
      .set(auth(tokenB))
      .expect(403);

    // History
    const history = await request(http).get('/api/game/history').set(auth(tokenA)).expect(200);
    expectNoAnswerFields(history.body);
    expect(history.body).toHaveLength(1);
    expect(history.body[0]).toMatchObject({ id: sessionId, totalScore: expectedTotal, accuracy: 60 });
    await request(http).get('/api/game/history?limit=0').set(auth(tokenA)).expect(400);
  }, 30_000); // about 50 requests against the remote database

  it('an answer after the time limit is a timeout: 0 points and incorrect', async () => {
    const start = await request(http)
      .post('/api/game/sessions')
      .set(auth(tokenB))
      .send({ categoryId: progId, difficulty: 'EASY' })
      .expect(201);
    const sessionId: string = start.body.sessionId;
    const [first] = await roundQuestions(sessionId);

    await rewindClock(sessionId, LEVELS.EASY.seconds + ANSWER_GRACE_SECONDS + 1);
    const res = await request(http)
      .post(`/api/game/sessions/${sessionId}/answers`)
      .set(auth(tokenB))
      .send({ index: 1, submitted: first!.answer })
      .expect(200);
    expect(res.body).toMatchObject({ isCorrect: false, timedOut: true, pointsEarned: 0, totalScore: 0 });

    const stored = await prisma.answer.findFirstOrThrow({ where: { sessionId } });
    expect(stored).toMatchObject({ isCorrect: false, pointsEarned: 0, submitted: '' });
  });

  it('starting a new round abandons the unfinished one; Difficult allows no hints', async () => {
    const previous = await prisma.gameSession.findFirstOrThrow({
      where: { user: { email: emails[1] }, status: 'IN_PROGRESS' },
    });

    const start = await request(http)
      .post('/api/game/sessions')
      .set(auth(tokenB))
      .send({ categoryId: progId, difficulty: 'DIFFICULT' })
      .expect(201);
    expect(start.body.hintsAllowed).toBe(0);

    const old = await prisma.gameSession.findUniqueOrThrow({ where: { id: previous.id } });
    expect(old.status).toBe('ABANDONED');

    const hint = await request(http)
      .post(`/api/game/sessions/${start.body.sessionId}/hint`)
      .set(auth(tokenB))
      .expect(403);
    expect(hint.body.message).toBe('Hints are not allowed on this level.');
  });

  it('an abandoned round scores nothing and cannot be played on', async () => {
    const live = await prisma.gameSession.findFirstOrThrow({
      where: { user: { email: emails[1] }, status: 'IN_PROGRESS' },
    });
    await request(http)
      .post(`/api/game/sessions/${live.id}/abandon`)
      .set(auth(tokenB))
      .expect(200, { sessionId: live.id, status: 'ABANDONED' });

    await request(http)
      .post(`/api/game/sessions/${live.id}/answers`)
      .set(auth(tokenB))
      .send({ index: 1, submitted: 'x' })
      .expect(409);
    await request(http).get(`/api/game/sessions/${live.id}/current`).set(auth(tokenB)).expect(409);

    const entries = await prisma.leaderboardEntry.count({ where: { user: { email: emails[1] } } });
    expect(entries).toBe(0);
  });

  it('GET /api/me/summary counts completed rounds only and lists every category', async () => {
    const res = await request(http).get('/api/me/summary').set(auth(tokenA)).expect(200);
    expect(res.body).toMatchObject({ totalPoints: roundA.total, roundsPlayed: 1 });
    expect(res.body.badges).toContainEqual({
      code: 'first_round',
      icon: expect.any(String),
      name: 'First Steps',
      earnedAt: expect.any(String),
    });
    expect(res.body.perCategory).toHaveLength(7);
    for (const row of res.body.perCategory) {
      expect(row).toEqual(
        row.categoryId === progId
          ? {
              categoryId: progId,
              name: expect.any(String),
              roundsPlayed: 1,
              accuracy: (roundA.correct / ROUND_SIZE) * 100,
              bestScore: roundA.total,
            }
          : { categoryId: expect.any(String), name: expect.any(String), roundsPlayed: 0, accuracy: 0, bestScore: 0 },
      );
    }

    // Student B only has abandoned rounds (one with an answered item): nothing counts.
    const answeredB = await prisma.answer.count({ where: { session: { user: { email: emails[1] } } } });
    expect(answeredB).toBeGreaterThan(0);
    const b = await request(http).get('/api/me/summary').set(auth(tokenB)).expect(200);
    expect(b.body).toMatchObject({ totalPoints: 0, roundsPlayed: 0, badges: [] });
    expect(b.body.perCategory).toHaveLength(7);
    expect(b.body.perCategory.every((r: { roundsPlayed: number }) => r.roundsPlayed === 0)).toBe(true);

    await request(http).get('/api/me/summary').set(auth(adminToken)).expect(403);
    await request(http).get('/api/me/summary').expect(401);
  });

  it('rejects bad starts and non-students', async () => {
    await request(http)
      .post('/api/game/sessions')
      .set(auth(tokenB))
      .send({ categoryId: 'no-such-category', difficulty: 'EASY' })
      .expect(404);
    await request(http)
      .post('/api/game/sessions')
      .set(auth(tokenB))
      .send({ categoryId: progId, difficulty: 'IMPOSSIBLE' })
      .expect(400);

    const empty = await prisma.category.create({
      data: {
        slug: `e2e-empty-${stamp}`,
        name: `e2e-empty-${stamp}`,
        icon: '📭',
        color: '#999999',
        description: 'Temporary category with no questions.',
      },
    });
    try {
      const res = await request(http)
        .post('/api/game/sessions')
        .set(auth(tokenB))
        .send({ categoryId: empty.id, difficulty: 'EASY' })
        .expect(404);
      expect(res.body.message).toBe('No questions available in this category yet.');
    } finally {
      await prisma.category.delete({ where: { id: empty.id } });
    }

    await request(http)
      .post('/api/game/sessions')
      .set(auth(adminToken))
      .send({ categoryId: progId, difficulty: 'EASY' })
      .expect(403);
  });
});
