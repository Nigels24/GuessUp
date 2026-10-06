import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { App } from 'supertest/types';
import { ROUND_SIZE } from './../src/common/game-rules.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { createApp, createTestAccount, deleteTestAccounts, type TestAccount } from './helpers.js';

/**
 * The harder badges awarded by POST /finish through the real database:
 * Flawless after a perfect Difficult round, Hot Streak once 10 correct
 * answers in a row span two rounds, and neither awarded twice.
 *   npm run test:e2e
 */
describe('Harder badges (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let prisma: PrismaService;
  let student: TestAccount;
  let token: string;
  let progId: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = await createApp();
    http = app.getHttpServer() as App;
    prisma = app.get(PrismaService);
    student = await createTestAccount(prisma, 'STUDENT', 'badges');
    const login = await request(http)
      .post('/api/auth/login')
      .send({ email: student.email, password: student.password })
      .expect(200);
    token = login.body.accessToken;
    const categories = await request(http).get('/api/categories').set(auth()).expect(200);
    progId = categories.body.find((c: { slug: string }) => c.slug === 'prog').id;
  });

  afterAll(async () => {
    if (prisma && student) await deleteTestAccounts(prisma, [student.email]);
    await app?.close();
  }, 60_000);

  /** Plays a Difficult Programming round answering every item correctly; returns the new badge codes. */
  async function perfectDifficultRound(): Promise<string[]> {
    const start = await request(http)
      .post('/api/game/sessions')
      .set(auth())
      .send({ categoryId: progId, difficulty: 'DIFFICULT' })
      .expect(201);
    const sessionId: string = start.body.sessionId;
    const { itemIds } = await prisma.gameSession.findUniqueOrThrow({ where: { id: sessionId } });
    const questions = await prisma.question.findMany({ where: { id: { in: itemIds } } });
    for (let index = 1; index <= ROUND_SIZE; index++) {
      if (index > 1) await request(http).get(`/api/game/sessions/${sessionId}/current`).set(auth()).expect(200);
      const question = questions.find((q) => q.id === itemIds[index - 1])!;
      const res = await request(http)
        .post(`/api/game/sessions/${sessionId}/answers`)
        .set(auth())
        .send({ index, submitted: question.answer })
        .expect(200);
      expect(res.body.isCorrect).toBe(true);
    }
    const finish = await request(http).post(`/api/game/sessions/${sessionId}/finish`).set(auth()).expect(200);
    return finish.body.newBadges.map((b: { code: string }) => b.code);
  }

  it('awards Flawless, then Hot Streak across two rounds, each once', async () => {
    const first = await perfectDifficultRound();
    expect(first).toEqual(expect.arrayContaining(['flawless', 'perfect']));
    // 5 correct so far: no streak yet.
    expect(first).not.toContain('hot_streak');

    const second = await perfectDifficultRound();
    expect(second).toContain('hot_streak');
    expect(second).not.toContain('flawless');

    const summary = await request(http).get('/api/me/summary').set(auth()).expect(200);
    const codes = summary.body.badges.map((b: { code: string }) => b.code);
    expect(codes.filter((c: string) => c === 'flawless')).toHaveLength(1);
    expect(codes).toContain('hot_streak');
    expect(summary.body.allBadges).toHaveLength(12);
  }, 120_000);
});
