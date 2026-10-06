import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { App } from 'supertest/types';
import { ROUND_SIZE } from './../src/common/game-rules.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { allKeys, createApp, createTestAccount, deleteTestAccounts, type TestAccount } from './helpers.js';

/**
 * End-to-end: the student side outside gameplay — leaderboard, My Progress
 * and Profile. Two throwaway students play real rounds through the API, so the
 * seeded demo account is left untouched; everything they create is deleted
 * after.
 *   npm run test:e2e
 */

const PASSWORD = 'longenough';
/** Must never appear in a leaderboard response. */
const PRIVATE_KEYS = ['email', 'passwordHash', 'role', 'status', 'avatarPublicId'];

describe('Student side: leaderboard, progress, profile (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let prisma: PrismaService;
  const stamp = Date.now();
  const emails = [`e2e-side-a-${stamp}@example.com`, `e2e-side-b-${stamp}@example.com`];
  let tokenA: string;
  let tokenB: string;
  let adminToken: string;
  let adminAccount: TestAccount | undefined;
  let idA: string;
  let idB: string;
  let progId: string;
  let otherId: string;
  /** Student A's round: the first item right, the rest wrong. */
  let roundA: { id: string; total: number };
  let roundB: { total: number };

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /**
   * Plays a whole round through the API. Item i is answered correctly when
   * `correct(i)` is true (answers are read from the database), otherwise wrong.
   */
  async function playRound(token: string, categoryId: string, correct: (i: number) => boolean) {
    const start = await request(http)
      .post('/api/game/sessions')
      .set(auth(token))
      .send({ categoryId, difficulty: 'EASY' })
      .expect(201);
    const sessionId: string = start.body.sessionId;
    const { itemIds } = await prisma.gameSession.findUniqueOrThrow({ where: { id: sessionId } });
    const questions = await prisma.question.findMany({ where: { id: { in: itemIds } } });

    for (let i = 0; i < itemIds.length; i++) {
      if (i > 0) await request(http).get(`/api/game/sessions/${sessionId}/current`).set(auth(token)).expect(200);
      const question = questions.find((q) => q.id === itemIds[i])!;
      await request(http)
        .post(`/api/game/sessions/${sessionId}/answers`)
        .set(auth(token))
        .send({ index: i + 1, submitted: correct(i) ? question.answer : 'definitely not the answer' })
        .expect(200);
    }
    const finish = await request(http)
      .post(`/api/game/sessions/${sessionId}/finish`)
      .set(auth(token))
      .expect(200);
    return { id: sessionId, total: finish.body.session.totalScore as number };
  }

  beforeAll(async () => {
    app = await createApp();
    http = app.getHttpServer() as App;
    prisma = app.get(PrismaService);

    const tokens: string[] = [];
    const ids: string[] = [];
    for (const email of emails) {
      const res = await request(http)
        .post('/api/auth/register')
        .send({ fullName: 'e2e-side-player', email, password: PASSWORD, yearLevel: '2nd Year' })
        .expect(201);
      tokens.push(res.body.accessToken);
      ids.push(res.body.user.id);
    }
    [tokenA, tokenB] = tokens as [string, string];
    [idA, idB] = ids as [string, string];

    adminAccount = await createTestAccount(prisma, 'ADMIN', 'side-admin');
    const admin = await request(http)
      .post('/api/auth/login')
      .send({ email: adminAccount.email, password: adminAccount.password })
      .expect(200);
    adminToken = admin.body.accessToken;

    const categories = await request(http).get('/api/categories').set(auth(tokenA)).expect(200);
    progId = categories.body.find((c: { slug: string }) => c.slug === 'prog').id;
    otherId = categories.body.find((c: { slug: string }) => c.slug !== 'prog').id;

    roundA = await playRound(tokenA, progId, (i) => i === 0);
    roundB = await playRound(tokenB, progId, () => true);
    // Two whole rounds against the remote database take longer than the default 10s.
  }, 60_000);

  afterAll(async () => {
    // By email, not by id, so a run that stopped during setup is cleaned up too.
    // Answers cascade with their session; leaderboard rows and badges with the user.
    if (prisma) await deleteTestAccounts(prisma, [...emails, ...(adminAccount ? [adminAccount.email] : [])]);
    await app?.close();
  }, 60_000);

  describe('GET /api/leaderboard/:categoryId', () => {
    it('ranks the category by points and returns the caller as "me"', async () => {
      const res = await request(http).get(`/api/leaderboard/${progId}`).set(auth(tokenA)).expect(200);
      expect(res.body.category).toMatchObject({ id: progId, slug: 'prog', name: expect.any(String) });
      expect(res.body.rows.length).toBeLessThanOrEqual(50);
      expect(res.body.totalPlayers).toBeGreaterThanOrEqual(2);
      expect(allKeys(res.body).filter((k) => PRIVATE_KEYS.includes(k))).toEqual([]);

      // Ranks run 1, 2, 3… in points order.
      const rows = res.body.rows as { rank: number; totalPoints: number }[];
      rows.forEach((row, i) => expect(row.rank).toBe(i + 1));
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i - 1]!.totalPoints).toBeGreaterThanOrEqual(rows[i]!.totalPoints);
      }

      expect(res.body.me).toEqual({
        rank: expect.any(Number),
        userId: idA,
        fullName: 'e2e-side-player',
        avatarUrl: null,
        totalPoints: roundA.total,
        roundsPlayed: 1,
        accuracy: Math.round((1 / ROUND_SIZE) * 100),
      });

      const b = await request(http).get(`/api/leaderboard/${progId}`).set(auth(tokenB)).expect(200);
      expect(b.body.me).toMatchObject({ userId: idB, totalPoints: roundB.total, accuracy: 100 });
      expect(b.body.me.rank).toBeLessThan(res.body.me.rank);
    });

    it('is per category: "me" is null where the student has not played', async () => {
      const res = await request(http).get(`/api/leaderboard/${otherId}`).set(auth(tokenA)).expect(200);
      expect(res.body.category.id).toBe(otherId);
      expect(res.body.me).toBeNull();
      expect(res.body.rows.some((r: { userId: string }) => r.userId === idA)).toBe(false);
    });

    it('is open to administrators (no "me"), 404 for an unknown category, 401 without a token', async () => {
      const admin = await request(http).get(`/api/leaderboard/${progId}`).set(auth(adminToken)).expect(200);
      expect(admin.body.me).toBeNull();
      const missing = await request(http).get('/api/leaderboard/no-such-category').set(auth(tokenA)).expect(404);
      expect(missing.body.message).toBe('Category not found.');
      await request(http).get(`/api/leaderboard/${progId}`).expect(401);
    });
  });

  describe('GET /api/me/progress', () => {
    it('totals completed rounds, accuracy by subject, topics to review and the score history', async () => {
      const res = await request(http).get('/api/me/progress').set(auth(tokenA)).expect(200);
      expect(res.body).toMatchObject({
        roundsPlayed: 1,
        totalPoints: roundA.total,
        accuracy: Math.round((1 / ROUND_SIZE) * 100),
      });
      expect(res.body.perCategory).toEqual([
        {
          category: expect.objectContaining({ id: progId }),
          roundsPlayed: 1,
          accuracy: Math.round((1 / ROUND_SIZE) * 100),
          avgScore: roundA.total,
        },
      ]);

      // Four wrong answers, grouped by topic; most missed first.
      const topics = res.body.topicsToReview as { wrong: number; correct: number; attempts: number; topic: string; category: { id: string } }[];
      expect(topics.length).toBeGreaterThan(0);
      expect(topics.length).toBeLessThanOrEqual(5);
      expect(topics.reduce((sum, t) => sum + t.wrong, 0)).toBe(ROUND_SIZE - 1);
      for (const t of topics) {
        expect(t.category.id).toBe(progId);
        expect(t.topic).toEqual(expect.any(String));
        expect(t.attempts).toBe(t.correct + t.wrong);
      }
      for (let i = 1; i < topics.length; i++) expect(topics[i - 1]!.wrong).toBeGreaterThanOrEqual(topics[i]!.wrong);

      expect(res.body.history).toHaveLength(1);
      expect(res.body.history[0]).toMatchObject({
        id: roundA.id,
        category: expect.objectContaining({ id: progId }),
        difficulty: 'EASY',
        totalScore: roundA.total,
        endedAt: expect.any(String),
      });
      // Progress is shown after answering, but stays free of answer keys anyway.
      expect(allKeys(res.body)).not.toContain('answer');
    });

    it('a student who missed nothing has no topics to review', async () => {
      const res = await request(http).get('/api/me/progress').set(auth(tokenB)).expect(200);
      expect(res.body).toMatchObject({ roundsPlayed: 1, accuracy: 100, topicsToReview: [] });
    });

    it('is for students only', async () => {
      await request(http).get('/api/me/progress').set(auth(adminToken)).expect(403);
      await request(http).get('/api/me/progress').expect(401);
    });
  });

  it('GET /api/me/summary lists all 12 badges for the badge grid', async () => {
    const res = await request(http).get('/api/me/summary').set(auth(tokenA)).expect(200);
    expect(res.body.allBadges).toHaveLength(12);
    expect(res.body.allBadges[0]).toEqual({
      code: 'first_round',
      icon: expect.any(String),
      name: 'First Steps',
      description: expect.any(String),
    });
  });

  describe('PATCH /api/me', () => {
    it('updates the full name and year level', async () => {
      const res = await request(http)
        .patch('/api/me')
        .set(auth(tokenA))
        .send({ fullName: '  e2e-edited-player  ', yearLevel: '4th Year' })
        .expect(200);
      expect(res.body).toEqual({
        id: idA,
        fullName: 'e2e-edited-player',
        email: emails[0],
        role: 'STUDENT',
        yearLevel: '4th Year',
        status: 'ACTIVE',
        avatarUrl: null,
      });
      const me = await request(http).get('/api/auth/me').set(auth(tokenA)).expect(200);
      expect(me.body).toMatchObject({ fullName: 'e2e-edited-player', yearLevel: '4th Year' });
    });

    it('validates the fields and refuses email or role changes', async () => {
      for (const body of [
        { fullName: 'X' },
        { fullName: 'x'.repeat(81) },
        { yearLevel: '5th Year' },
        { email: 'other@example.com' },
        { role: 'ADMIN' },
      ]) {
        await request(http).patch('/api/me').set(auth(tokenA)).send(body).expect(400);
      }
      const user = await prisma.user.findUniqueOrThrow({ where: { id: idA } });
      expect(user).toMatchObject({ email: emails[0], role: 'STUDENT', fullName: 'e2e-edited-player' });
    });

    it('needs a token', async () => {
      await request(http).patch('/api/me').send({ fullName: 'Nobody' }).expect(401);
    });
  });

  describe('POST /api/me/password', () => {
    it('refuses a wrong current password with 400 (not 401, which would sign the app out)', async () => {
      const res = await request(http)
        .post('/api/me/password')
        .set(auth(tokenB))
        .send({ currentPassword: 'wrong-password', newPassword: 'brand-new-pass' })
        .expect(400);
      expect(res.body.message).toBe('Current password is incorrect.');
    });

    it('validates the new password', async () => {
      await request(http)
        .post('/api/me/password')
        .set(auth(tokenB))
        .send({ currentPassword: PASSWORD, newPassword: 'short' })
        .expect(400);
      await request(http)
        .post('/api/me/password')
        .set(auth(tokenB))
        .send({ currentPassword: PASSWORD })
        .expect(400);
    });

    it('changes the password: the new one logs in, the old one no longer does', async () => {
      await request(http)
        .post('/api/me/password')
        .set(auth(tokenB))
        .send({ currentPassword: PASSWORD, newPassword: 'brand-new-pass' })
        .expect(204);
      const { passwordHash } = await prisma.user.findUniqueOrThrow({ where: { id: idB } });
      expect(passwordHash).toMatch(/^\$2[aby]\$10\$/); // bcrypt, cost 10

      await request(http)
        .post('/api/auth/login')
        .send({ email: emails[1], password: 'brand-new-pass' })
        .expect(200);
      await request(http)
        .post('/api/auth/login')
        .send({ email: emails[1], password: PASSWORD })
        .expect(401);
    });

    it('a student cannot change another user\'s password', async () => {
      // The route only ever changes the caller's own password; naming someone else is refused.
      for (const extra of [{ userId: idB }, { email: emails[1] }]) {
        await request(http)
          .post('/api/me/password')
          .set(auth(tokenA))
          .send({ currentPassword: PASSWORD, newPassword: 'taken-over-pass', ...extra })
          .expect(400);
      }
      await request(http).post('/api/auth/login').send({ email: emails[1], password: 'brand-new-pass' }).expect(200);
      await request(http).post('/api/auth/login').send({ email: emails[0], password: 'taken-over-pass' }).expect(401);
    });
  });
  describe('My account for administrators (PATCH /api/me, POST /api/me/password)', () => {
    let own: TestAccount;
    let ownToken: string;

    beforeAll(async () => {
      own = await createTestAccount(prisma, 'ADMIN', 'account-admin');
      ownToken = (await request(http).post('/api/auth/login').send({ email: own.email, password: own.password }).expect(200))
        .body.accessToken;
    }, 60_000);

    afterAll(async () => {
      if (own) await deleteTestAccounts(prisma, [own.email]);
    });

    it('edits the full name; an administrator has no year level', async () => {
      const res = await request(http).patch('/api/me').set(auth(ownToken)).send({ fullName: '  e2e-renamed-admin ' }).expect(200);
      expect(res.body).toMatchObject({ id: own.id, fullName: 'e2e-renamed-admin', role: 'ADMIN', yearLevel: null });
      const bad = await request(http).patch('/api/me').set(auth(ownToken)).send({ yearLevel: '1st Year' }).expect(400);
      expect(bad.body.message).toBe('Administrator accounts have no year level.');
    });

    it('refuses a wrong current password, a short one and the same one (400)', async () => {
      const wrong = await request(http)
        .post('/api/me/password')
        .set(auth(ownToken))
        .send({ currentPassword: 'not-my-password', newPassword: 'a-long-new-password' })
        .expect(400);
      expect(wrong.body.message).toBe('Current password is incorrect.');

      const short = await request(http)
        .post('/api/me/password')
        .set(auth(ownToken))
        .send({ currentPassword: own.password, newPassword: '123456789' })
        .expect(400);
      expect(short.body.message).toBe('Administrator passwords must be at least 10 characters.');

      const same = await request(http)
        .post('/api/me/password')
        .set(auth(ownToken))
        .send({ currentPassword: own.password, newPassword: own.password })
        .expect(400);
      expect(same.body.message).toBe('The new password must be different from the current password.');
    });

    it('changes the password: the old one fails, the new one works, and the session stays', async () => {
      const newPassword = `e2e-${Date.now()}-admin-pass`;
      await request(http)
        .post('/api/me/password')
        .set(auth(ownToken))
        .send({ currentPassword: own.password, newPassword })
        .expect(204);
      await request(http).post('/api/auth/login').send({ email: own.email, password: own.password }).expect(401);
      await request(http).post('/api/auth/login').send({ email: own.email, password: newPassword }).expect(200);
      await request(http).get('/api/auth/me').set(auth(ownToken)).expect(200);
    });

    it('progress and summary stay student-only', async () => {
      await request(http).get('/api/me/summary').set(auth(ownToken)).expect(403);
      await request(http).get('/api/me/progress').set(auth(ownToken)).expect(403);
    });
  });
});
