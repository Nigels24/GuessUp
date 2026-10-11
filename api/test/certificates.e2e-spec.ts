import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { createApp, createTestAccount, deleteTestAccounts, type TestAccount } from './helpers.js';

type Level = 'EASY' | 'AVERAGE' | 'DIFFICULT';

/**
 * Stars and the category completion certificate through the real database:
 * an e2e- student passes (2+ stars, 3 of 5 correct) Easy, Average and Difficult
 * in one category; finishing a level with fewer stars does not count; the
 * round that makes the last level pass reports the certificate, the student's summary
 * and the admin endpoints list it, and another student cannot read it.
 *   npm run test:e2e
 */
describe('Stars and certificates (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let prisma: PrismaService;
  let student: TestAccount;
  let other: TestAccount;
  let admin: TestAccount;
  const tokens: Record<string, string> = {};
  let progId: string;

  const as = (who: TestAccount) => ({ Authorization: `Bearer ${tokens[who.email]}` });

  async function login(account: TestAccount) {
    const res = await request(http)
      .post('/api/auth/login')
      .send({ email: account.email, password: account.password })
      .expect(200);
    tokens[account.email] = res.body.accessToken;
  }

  beforeAll(async () => {
    app = await createApp();
    http = app.getHttpServer() as App;
    prisma = app.get(PrismaService);
    student = await createTestAccount(prisma, 'STUDENT', 'cert');
    other = await createTestAccount(prisma, 'STUDENT', 'cert-other');
    admin = await createTestAccount(prisma, 'ADMIN', 'cert-admin');
    for (const account of [student, other, admin]) await login(account);
    const categories = await request(http).get('/api/categories').set(as(student)).expect(200);
    progId = categories.body.find((c: { slug: string }) => c.slug === 'prog').id;
  });

  afterAll(async () => {
    if (prisma && student) await deleteTestAccounts(prisma, [student.email, other.email, admin.email]);
    await app?.close();
  }, 60_000);

  /** Plays a Programming round with `correct` right answers (the first ones); returns the /finish body. */
  async function playRound(difficulty: Level, correct: number) {
    const start = await request(http)
      .post('/api/game/sessions')
      .set(as(student))
      .send({ categoryId: progId, difficulty })
      .expect(201);
    const sessionId: string = start.body.sessionId;
    const { itemIds, totalItems } = await prisma.gameSession.findUniqueOrThrow({ where: { id: sessionId } });
    const questions = await prisma.question.findMany({ where: { id: { in: itemIds } } });
    for (let index = 1; index <= totalItems; index++) {
      if (index > 1) await request(http).get(`/api/game/sessions/${sessionId}/current`).set(as(student)).expect(200);
      const question = questions.find((q) => q.id === itemIds[index - 1])!;
      await request(http)
        .post(`/api/game/sessions/${sessionId}/answers`)
        .set(as(student))
        .send({ index, submitted: index <= correct ? question.answer : 'zz-not-the-answer' })
        .expect(200);
    }
    const finish = await request(http).post(`/api/game/sessions/${sessionId}/finish`).set(as(student)).expect(200);
    return finish.body;
  }

  it('gives stars per round and the certificate once every level is passed', async () => {
    // An abandoned Difficult round does not count toward the certificate and has no stars.
    const quit = await request(http)
      .post('/api/game/sessions')
      .set(as(student))
      .send({ categoryId: progId, difficulty: 'DIFFICULT' })
      .expect(201);
    await request(http).post(`/api/game/sessions/${quit.body.sessionId}/abandon`).set(as(student)).expect(200);

    const easy = await playRound('EASY', 5);
    expect(easy.session.stars).toBe(3);
    expect(easy.certificate).toBeNull();

    const average = await playRound('AVERAGE', 3);
    expect(average.session.stars).toBe(2);
    expect(average.certificate).toBeNull();

    let summary = await request(http).get('/api/me/summary').set(as(student)).expect(200);
    expect(summary.body.certificates).toEqual([]);
    const progBefore = summary.body.perCategory.find((p: { categoryId: string }) => p.categoryId === progId);
    expect(progBefore.bestStars).toEqual({ EASY: 3, AVERAGE: 2, DIFFICULT: null });

    // Finishing Difficult below 2 stars does not pass it: no certificate yet.
    const zero = await playRound('DIFFICULT', 0);
    expect(zero.session.stars).toBe(0);
    expect(zero.certificate).toBeNull();
    const two = await playRound('DIFFICULT', 2);
    expect(two.session.stars).toBe(1);
    expect(two.certificate).toBeNull();
    summary = await request(http).get('/api/me/summary').set(as(student)).expect(200);
    expect(summary.body.certificates).toEqual([]);
    await request(http).get(`/api/admin/certificates/${student.id}/${progId}`).set(as(admin)).expect(404);

    const difficult = await playRound('DIFFICULT', 3);
    expect(difficult.session.stars).toBe(2);
    expect(difficult.certificate).toMatchObject({ category: { id: progId } });
    const completedAt: string = difficult.certificate.completedAt;
    expect(completedAt).toBe(difficult.session.endedAt);

    // A later round in the same category does not report the certificate again.
    const replay = await playRound('EASY', 2);
    expect(replay.session.stars).toBe(1);
    expect(replay.certificate).toBeNull();

    summary = await request(http).get('/api/me/summary').set(as(student)).expect(200);
    expect(summary.body.certificates).toEqual([
      expect.objectContaining({ categoryId: progId, completedAt }),
    ]);

    const history = await request(http).get('/api/game/history').set(as(student)).expect(200);
    expect(history.body.map((h: { stars: number }) => h.stars)).toEqual([1, 2, 1, 0, 2, 3]);

    const round = await request(http).get(`/api/game/sessions/${zero.session.id}`).set(as(student)).expect(200);
    expect(round.body.session.stars).toBe(0);

    // Admin: the session list shows stars, and none for the abandoned round.
    const sessions = await request(http)
      .get(`/api/admin/sessions?studentId=${student.id}`)
      .set(as(admin))
      .expect(200);
    const byStatus = sessions.body.items.map((s: { status: string; stars: number | null }) => [s.status, s.stars]);
    expect(byStatus).toContainEqual(['ABANDONED', null]);
    expect(byStatus.filter(([status]: [string]) => status === 'COMPLETED')).toHaveLength(6);

    const detail = await request(http).get(`/api/admin/sessions/${easy.session.id}`).set(as(admin)).expect(200);
    expect(detail.body.stars).toBe(3);

    // Admin: the certificate in the list, on the student, and printable.
    const list = await request(http).get(`/api/admin/certificates?categoryId=${progId}`).set(as(admin)).expect(200);
    expect(list.body).toContainEqual(
      expect.objectContaining({ student: expect.objectContaining({ id: student.id }), completedAt }),
    );
    const studentDetail = await request(http).get(`/api/admin/students/${student.id}`).set(as(admin)).expect(200);
    expect(studentDetail.body.certificates).toEqual([
      expect.objectContaining({ category: expect.objectContaining({ id: progId }), completedAt }),
    ]);
    const certificate = await request(http)
      .get(`/api/admin/certificates/${student.id}/${progId}`)
      .set(as(admin))
      .expect(200);
    expect(certificate.body.student.fullName).toBe('e2e-cert');
    expect(
      certificate.body.levels.map((l: { difficulty: string; correctCount: number; stars: number }) => [
        l.difficulty,
        l.correctCount,
        l.stars,
      ]),
    ).toEqual([
      ['EASY', 5, 3],
      ['AVERAGE', 3, 2],
      ['DIFFICULT', 3, 2],
    ]);

    // Not earned: 404.
    await request(http).get(`/api/admin/certificates/${other.id}/${progId}`).set(as(admin)).expect(404);
  }, 180_000);

  it('another student sees none of it and cannot use the admin routes', async () => {
    const summary = await request(http).get('/api/me/summary').set(as(other)).expect(200);
    expect(summary.body.certificates).toEqual([]);
    await request(http).get('/api/admin/certificates').set(as(other)).expect(403);
    await request(http).get(`/api/admin/certificates/${student.id}/${progId}`).set(as(other)).expect(403);
    await request(http).get(`/api/admin/certificates/${student.id}/${progId}`).set(as(student)).expect(403);
    await request(http).get('/api/admin/certificates').expect(401);
  });
});
