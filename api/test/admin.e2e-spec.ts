import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { createApp, createTestAccount, deleteTestAccounts, type TestAccount } from './helpers.js';

/**
 * End-to-end: the Admin Panel API (/api/admin/...). Works on a throwaway
 * category, its questions and one throwaway student; everything created here
 * is deleted after. The seeded bank and demo accounts are only read.
 *   npm run test:e2e
 */

describe('Admin Panel API (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let prisma: PrismaService;
  const stamp = Date.now();
  const studentEmail = `e2e-admin-student-${stamp}@example.com`;
  let adminToken: string;
  let adminAccount: TestAccount | undefined;
  let midRoundStudent: TestAccount | undefined;
  let studentToken: string;
  let studentId: string;
  let categoryId: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const mcQuestion = (over: Record<string, unknown> = {}) => ({
    categoryId,
    type: 'MULTIPLE_CHOICE',
    difficulty: 'EASY',
    questionText: `e2e-question-${stamp}`,
    answer: 'Right',
    choices: ['Wrong A', 'Wrong B', 'Wrong C'],
    explanation: 'Because it is right.',
    topic: 'e2e-topic',
    ...over,
  });

  async function createQuestion(over: Record<string, unknown> = {}) {
    const res = await request(http)
      .post('/api/admin/questions')
      .set(auth(adminToken))
      .send(mcQuestion(over))
      .expect(201);
    return res.body as { id: string; isActive: boolean };
  }

  beforeAll(async () => {
    app = await createApp();
    http = app.getHttpServer() as App;
    prisma = app.get(PrismaService);

    adminAccount = await createTestAccount(prisma, 'ADMIN', 'panel-admin');
    const admin = await request(http)
      .post('/api/auth/login')
      .send({ email: adminAccount.email, password: adminAccount.password })
      .expect(200);
    adminToken = admin.body.accessToken;
    const student = await request(http)
      .post('/api/auth/register')
      .send({ fullName: 'e2e-admin-student', email: studentEmail, password: 'longenough', yearLevel: '3rd Year' })
      .expect(201);
    studentToken = student.body.accessToken;
    studentId = student.body.user.id;

    const category = await request(http)
      .post('/api/admin/categories')
      .set(auth(adminToken))
      .send({ name: `e2e-category-${stamp}`, icon: '🧪', color: '#12ab34', description: 'Throwaway.' })
      .expect(201);
    categoryId = category.body.id;
  }, 60_000);

  afterAll(async () => {
    // Found by this run's stamp, not only by the ids captured above, so a run
    // that stopped half way is cleaned up too. Every name, slug, email and
    // question text this file creates starts with "e2e-" and ends with the stamp.
    if (prisma) {
      const categories = { slug: { startsWith: 'e2e-', endsWith: `-${stamp}` } };
      await prisma.gameSession.deleteMany({
        where: { OR: [{ user: { email: studentEmail } }, { category: categories }] },
      });
      await prisma.question.deleteMany({
        where: { seedKey: null, OR: [{ category: categories }, { questionText: { startsWith: 'e2e-', endsWith: `-${stamp}` } }] },
      });
      await prisma.category.deleteMany({ where: categories });
      await deleteTestAccounts(prisma, [studentEmail, ...[adminAccount, midRoundStudent].flatMap((a) => (a ? [a.email] : []))]);
    }
    await app?.close();
  }, 60_000);

  describe('access', () => {
    const routes = [
      ['get', '/api/admin/dashboard'],
      ['get', '/api/admin/categories'],
      ['post', '/api/admin/categories'],
      ['get', '/api/admin/questions'],
      ['post', '/api/admin/questions'],
      ['post', '/api/admin/uploads/image'],
      ['get', '/api/admin/students'],
      ['get', '/api/admin/sessions'],
      ['get', '/api/admin/reports/activity'],
      ['get', '/api/admin/reports/scores'],
      ['get', '/api/admin/reports/most-missed'],
    ] as const;

    it('every admin route is 403 for a student and 401 without a token', async () => {
      for (const [method, path] of routes) {
        await request(http)[method](path).set(auth(studentToken)).expect(403);
        await request(http)[method](path).expect(401);
      }
    }, 30_000);
  });

  describe('categories', () => {
    it('lists categories with question counts per difficulty', async () => {
      const res = await request(http).get('/api/admin/categories').set(auth(adminToken)).expect(200);
      const prog = res.body.find((c: { slug: string }) => c.slug === 'prog');
      expect(prog.questionCount).toBeGreaterThanOrEqual(15);
      expect(Object.keys(prog.byDifficulty)).toEqual(['EASY', 'AVERAGE', 'DIFFICULT']);
      expect(prog.byDifficulty.EASY.total).toBeGreaterThanOrEqual(5);
    });

    it('made the slug from the name and stored the color in uppercase', async () => {
      const res = await request(http).get('/api/admin/categories').set(auth(adminToken)).expect(200);
      const mine = res.body.find((c: { id: string }) => c.id === categoryId);
      expect(mine).toMatchObject({ slug: `e2e-category-${stamp}`, color: '#12AB34', questionCount: 0 });
    });

    it('refuses a duplicate name (ignoring case), a bad icon and a bad color', async () => {
      const dup = await request(http)
        .post('/api/admin/categories')
        .set(auth(adminToken))
        .send({ name: 'computer programming', icon: '💻', color: '#000000', description: '' })
        .expect(409);
      expect(dup.body.message).toBe('A category with that name already exists.');
      await request(http)
        .post('/api/admin/categories')
        .set(auth(adminToken))
        .send({ name: `e2e-bad-${stamp}`, icon: 'AB', color: '#000000', description: '' })
        .expect(400);
      await request(http)
        .post('/api/admin/categories')
        .set(auth(adminToken))
        .send({ name: `e2e-bad-${stamp}`, icon: '📘', color: 'red', description: '' })
        .expect(400);
    });

    it('updates name, icon, color and description but never the slug', async () => {
      const res = await request(http)
        .patch(`/api/admin/categories/${categoryId}`)
        .set(auth(adminToken))
        .send({ description: 'Updated.', icon: '🧫' })
        .expect(200);
      expect(res.body).toMatchObject({ description: 'Updated.', icon: '🧫' });
      await request(http)
        .patch(`/api/admin/categories/${categoryId}`)
        .set(auth(adminToken))
        .send({ slug: 'renamed' })
        .expect(400);
    });

    it('refuses to delete a category that has questions (409, with the reason)', async () => {
      const prog = (await prisma.category.findUniqueOrThrow({ where: { slug: 'prog' } })).id;
      const res = await request(http).delete(`/api/admin/categories/${prog}`).set(auth(adminToken)).expect(409);
      expect(res.body.message).toMatch(/^Computer Programming still has \d+ questions\. Delete or move them first/);
    });

    it('deletes an unused category (204), then 404', async () => {
      const temp = await request(http)
        .post('/api/admin/categories')
        .set(auth(adminToken))
        .send({ name: `e2e-temp-${stamp}`, icon: '🗑️', color: '#FF0000', description: '' })
        .expect(201);
      await request(http).delete(`/api/admin/categories/${temp.body.id}`).set(auth(adminToken)).expect(204);
      await request(http).delete(`/api/admin/categories/${temp.body.id}`).set(auth(adminToken)).expect(404);
    });
  });

  describe('questions', () => {
    it('creates, reads and updates a multiple-choice item', async () => {
      const created = await createQuestion({ hint: 'It is right.' });
      const got = await request(http).get(`/api/admin/questions/${created.id}`).set(auth(adminToken)).expect(200);
      expect(got.body).toMatchObject({ answer: 'Right', choices: ['Wrong A', 'Wrong B', 'Wrong C'], answerCount: 0 });

      const updated = await request(http)
        .patch(`/api/admin/questions/${created.id}`)
        .set(auth(adminToken))
        .send({ difficulty: 'AVERAGE', topic: 'Updated' })
        .expect(200);
      expect(updated.body).toMatchObject({ difficulty: 'AVERAGE', topic: 'Updated', hint: 'It is right.' });
    });

    it("returns the rules' messages: duplicate options, a hint on Difficult, a picture without an image, a bad puzzle", async () => {
      const send = (over: Record<string, unknown>) =>
        request(http).post('/api/admin/questions').set(auth(adminToken)).send(mcQuestion(over)).expect(400);

      expect((await send({ choices: ['right', 'B', 'C'] })).body.message).toContain('The 4 options must all be different.');
      expect((await send({ difficulty: 'DIFFICULT', hint: 'x' })).body.message).toContain(
        'Difficult items have no hints. Leave the hint empty.',
      );
      expect((await send({ type: 'PICTURE', choices: [] })).body.message).toContain('Upload an image for picture items.');
      expect((await send({ type: 'WORD_PUZZLE', answer: 'TCP/IP' })).body.message).toContain(
        'Word puzzle answers may only contain letters and spaces.',
      );
      expect((await send({ difficulty: 'HARD' })).body.message).toContain('Choose a difficulty level.');
      expect((await send({ categoryId: 'missing' })).body.message).toContain('Choose a subject category.');
    });

    it('editing cannot break an item either: removing a choice is refused', async () => {
      const created = await createQuestion();
      const res = await request(http)
        .patch(`/api/admin/questions/${created.id}`)
        .set(auth(adminToken))
        .send({ choices: ['Only one'] })
        .expect(400);
      expect(res.body.message).toContain('Multiple-choice items need 3 wrong options.');
    });

    it('saves a picture item that uses a seeded /static picture', async () => {
      const res = await request(http)
        .post('/api/admin/questions')
        .set(auth(adminToken))
        .send(mcQuestion({ type: 'PICTURE', choices: [], answer: 'Star topology', imageUrl: '/static/images/star.svg' }))
        .expect(201);
      expect(res.body).toMatchObject({ imageUrl: '/static/images/star.svg', imagePublicId: null, choices: [] });
    });

    it('filters by category, type, active and search text, with pagination', async () => {
      const res = await request(http)
        .get('/api/admin/questions')
        .query({ categoryId, type: 'MULTIPLE_CHOICE', active: 'true', search: `e2e-question-${stamp}`, pageSize: 2 })
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.total).toBeGreaterThanOrEqual(2);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.pageSize).toBe(2);
      for (const q of res.body.items) expect(q).toMatchObject({ type: 'MULTIPLE_CHOICE', isActive: true });

      const seeded = await request(http).get('/api/admin/questions').query({ pageSize: 100 }).set(auth(adminToken)).expect(200);
      expect(seeded.body.total).toBeGreaterThanOrEqual(105);
    });

    it('hard-deletes a question nobody answered', async () => {
      const created = await createQuestion();
      const res = await request(http).delete(`/api/admin/questions/${created.id}`).set(auth(adminToken)).expect(200);
      expect(res.body.outcome).toBe('DELETED');
      await request(http).get(`/api/admin/questions/${created.id}`).set(auth(adminToken)).expect(404);
    });

    it('deactivates (never deletes) a question that has recorded answers', async () => {
      // A category of its own with one item, so the student's round draws exactly it.
      const solo = await request(http)
        .post('/api/admin/categories')
        .set(auth(adminToken))
        .send({ name: `e2e-solo-${stamp}`, icon: '🎯', color: '#123456', description: '' })
        .expect(201);
      const question = await createQuestion({ categoryId: solo.body.id });

      const round = await request(http)
        .post('/api/game/sessions')
        .set(auth(studentToken))
        .send({ categoryId: solo.body.id, difficulty: 'EASY' })
        .expect(201);
      // While the round is being played the question cannot be deleted either.
      const live = await request(http).delete(`/api/admin/questions/${question.id}`).set(auth(adminToken)).expect(200);
      expect(live.body.outcome).toBe('DEACTIVATED');
      await request(http).patch(`/api/admin/questions/${question.id}/active`).set(auth(adminToken)).send({ isActive: true }).expect(200);

      await request(http)
        .post(`/api/game/sessions/${round.body.sessionId}/answers`)
        .set(auth(studentToken))
        .send({ index: 1, submitted: 'Wrong A' })
        .expect(200);
      await request(http).post(`/api/game/sessions/${round.body.sessionId}/finish`).set(auth(studentToken)).expect(200);

      const res = await request(http).delete(`/api/admin/questions/${question.id}`).set(auth(adminToken)).expect(200);
      expect(res.body.outcome).toBe('DEACTIVATED');
      expect(res.body.message).toMatch(/has 1 recorded answer, so it was deactivated instead of deleted/);
      const after = await prisma.question.findUniqueOrThrow({ where: { id: question.id } });
      expect(after.isActive).toBe(false);
    }, 60_000); // a real round against the remote database
  });

  describe('gameplay only serves active questions', () => {
    it('never draws an inactive question, and with none active there is no round', async () => {
      const pool = await request(http)
        .post('/api/admin/categories')
        .set(auth(adminToken))
        .send({ name: `e2e-pool-${stamp}`, icon: '🎲', color: '#654321', description: '' })
        .expect(201);
      const ids: string[] = [];
      for (let i = 0; i < 6; i++) ids.push((await createQuestion({ categoryId: pool.body.id, questionText: `e2e-pool-${i}-${stamp}` })).id);
      const inactive = ids.slice(0, 3);
      for (const id of inactive) {
        await request(http).patch(`/api/admin/questions/${id}/active`).set(auth(adminToken)).send({ isActive: false }).expect(200);
      }

      // The student home screen counts active questions only.
      const categories = await request(http).get('/api/categories').set(auth(studentToken)).expect(200);
      expect(categories.body.find((c: { id: string }) => c.id === pool.body.id).activeQuestionCount).toBe(3);

      for (let r = 0; r < 4; r++) {
        const round = await request(http)
          .post('/api/game/sessions')
          .set(auth(studentToken))
          .send({ categoryId: pool.body.id, difficulty: 'EASY' })
          .expect(201);
        expect(round.body.totalItems).toBe(3);
        const { itemIds } = await prisma.gameSession.findUniqueOrThrow({ where: { id: round.body.sessionId } });
        expect(itemIds.some((id) => inactive.includes(id))).toBe(false);
      }

      for (const id of ids.slice(3)) {
        await request(http).patch(`/api/admin/questions/${id}/active`).set(auth(adminToken)).send({ isActive: false }).expect(200);
      }
      const none = await request(http)
        .post('/api/game/sessions')
        .set(auth(studentToken))
        .send({ categoryId: pool.body.id, difficulty: 'EASY' })
        .expect(404);
      expect(none.body.message).toBe('No questions available in this category yet.');
    }, 60_000); // about 30 requests against the remote database
  });

  describe('image upload', () => {
    it('answers 503 with a clear message when Cloudinary is not configured, else checks the file', async () => {
      const configured = Boolean(
        process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET,
      );
      const res = await request(http)
        .post('/api/admin/uploads/image')
        .set(auth(adminToken))
        .attach('file', Buffer.from('not an image'), 'notes.png');
      if (configured) {
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Only JPG, PNG, WebP and SVG images can be uploaded.');
      } else {
        expect(res.status).toBe(503);
        expect(res.body.message).toMatch(/CLOUDINARY_CLOUD_NAME/);
      }
    });

    it('lists the seeded picture library', async () => {
      const res = await request(http).get('/api/admin/uploads/library').set(auth(adminToken)).expect(200);
      expect(res.body).toContainEqual({ name: 'star', url: '/static/images/star.svg' });
      await request(http).get('/api/admin/uploads/library').set(auth(studentToken)).expect(403);
    });

    it('refuses to discard an image id outside the GuessUp folder', async () => {
      await request(http)
        .delete('/api/admin/uploads/image')
        .query({ publicId: 'someone-else/photo' })
        .set(auth(adminToken))
        .expect(400);
    });
  });

  describe('students', () => {
    it('lists students only (never administrators), with stats and filters', async () => {
      const res = await request(http)
        .get('/api/admin/students')
        .query({ search: studentEmail, yearLevel: '3rd Year', status: 'ACTIVE' })
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({ id: studentId, rounds: 1, yearLevel: '3rd Year' });
      expect(res.body.items[0].lastActive).not.toBeNull();
      expect(res.body.items[0]).not.toHaveProperty('passwordHash');

      const admins = await request(http).get('/api/admin/students').query({ search: adminAccount!.email }).set(auth(adminToken)).expect(200);
      expect(admins.body.items).toHaveLength(0);
    });

    it('"last active" counts answers in a round that is not finished', async () => {
      midRoundStudent = await createTestAccount(prisma, 'STUDENT', 'mid-round');
      const login = await request(http)
        .post('/api/auth/login')
        .send({ email: midRoundStudent.email, password: midRoundStudent.password })
        .expect(200);
      const before = await request(http).get('/api/admin/students').query({ search: midRoundStudent.email }).set(auth(adminToken)).expect(200);
      expect(before.body.items[0]).toMatchObject({ rounds: 0, lastActive: null });

      const prog = (await prisma.category.findUniqueOrThrow({ where: { slug: 'prog' } })).id;
      const round = await request(http)
        .post('/api/game/sessions')
        .set(auth(login.body.accessToken))
        .send({ categoryId: prog, difficulty: 'EASY' })
        .expect(201);
      await request(http)
        .post(`/api/game/sessions/${round.body.sessionId}/answers`)
        .set(auth(login.body.accessToken))
        .send({ index: 1, submitted: 'e2e-wrong' })
        .expect(200);

      const after = await request(http).get('/api/admin/students').query({ search: midRoundStudent.email }).set(auth(adminToken)).expect(200);
      expect(after.body.items[0].rounds).toBe(0);
      const answer = await prisma.answer.findFirstOrThrow({ where: { sessionId: round.body.sessionId } });
      expect(new Date(after.body.items[0].lastActive).getTime()).toBe(answer.createdAt.getTime());
    }, 60_000);

    it('shows one student with per-category accuracy', async () => {
      const res = await request(http).get(`/api/admin/students/${studentId}`).set(auth(adminToken)).expect(200);
      expect(res.body.perCategory).toHaveLength(1);
      expect(res.body.topicsToReview[0]).toMatchObject({ topic: 'e2e-topic', wrong: 1 });
    });

    it('deactivates (the student loses access at once) and activates again', async () => {
      await request(http)
        .patch(`/api/admin/students/${studentId}/status`)
        .set(auth(adminToken))
        .send({ status: 'INACTIVE' })
        .expect(200);
      await request(http).get('/api/me/summary').set(auth(studentToken)).expect(403);
      const back = await request(http)
        .patch(`/api/admin/students/${studentId}/status`)
        .set(auth(adminToken))
        .send({ status: 'ACTIVE' })
        .expect(200);
      expect(back.body.status).toBe('ACTIVE');
      await request(http).get('/api/me/summary').set(auth(studentToken)).expect(200);
    });

    it('cannot deactivate an administrator (404)', async () => {
      const admin = adminAccount!;
      await request(http)
        .patch(`/api/admin/students/${admin.id}/status`)
        .set(auth(adminToken))
        .send({ status: 'INACTIVE' })
        .expect(404);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).status).toBe('ACTIVE');
    });
  });

  describe('game sessions', () => {
    it('lists sessions with filters and shows one with its answers', async () => {
      const list = await request(http)
        .get('/api/admin/sessions')
        .query({ studentId, status: 'COMPLETED' })
        .set(auth(adminToken))
        .expect(200);
      expect(list.body.total).toBe(1);
      const row = list.body.items[0];
      expect(row).toMatchObject({ status: 'COMPLETED', answeredCount: 1, user: { id: studentId, avatarUrl: null } });
      expect(row.user).not.toHaveProperty('avatarPublicId');

      const detail = await request(http).get(`/api/admin/sessions/${row.id}`).set(auth(adminToken)).expect(200);
      expect(detail.body.answers).toHaveLength(1);
      expect(detail.body.answers[0]).toMatchObject({
        index: 1,
        submitted: 'Wrong A',
        isCorrect: false,
        hintUsed: false,
        pointsEarned: 0,
        question: { answer: 'Right' },
      });

      const abandoned = await request(http)
        .get('/api/admin/sessions')
        .query({ studentId, status: 'ABANDONED' })
        .set(auth(adminToken))
        .expect(200);
      expect(abandoned.body.total).toBeGreaterThanOrEqual(1);
    });

    it('validates the date filter', async () => {
      await request(http).get('/api/admin/sessions').query({ from: '04/10/2026' }).set(auth(adminToken)).expect(400);
      await request(http)
        .get('/api/admin/sessions')
        .query({ from: '2026-10-05', to: '2026-10-01' })
        .set(auth(adminToken))
        .expect(400);
    });
  });

  describe('reports and dashboard', () => {
    it('player activity includes the round, as JSON and CSV', async () => {
      const json = await request(http).get('/api/admin/reports/activity').set(auth(adminToken)).expect(200);
      expect(json.body.roundsPerDay).toHaveLength(30);
      expect(json.body.players.some((p: { student: { id: string } }) => p.student.id === studentId)).toBe(true);

      const csv = await request(http).get('/api/admin/reports/activity').query({ format: 'csv' }).set(auth(adminToken)).expect(200);
      expect(csv.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(csv.headers['content-disposition']).toMatch(/^attachment; filename="guessup_player_activity_\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}\.csv"$/);
      expect(csv.text.charCodeAt(0)).toBe(0xfeff);
      expect(csv.text).toContain('Rank,Student,Email,Year,Rounds,Points,Accuracy %,Last played\r\n');
      expect(csv.text).toContain(studentEmail);
    });

    it('average scores per category and difficulty, as JSON and CSV', async () => {
      const json = await request(http).get('/api/admin/reports/scores').set(auth(adminToken)).expect(200);
      expect(json.body.byDifficulty.map((r: { difficulty: string }) => r.difficulty)).toEqual(['EASY', 'AVERAGE', 'DIFFICULT']);
      const csv = await request(http).get('/api/admin/reports/scores?format=csv').set(auth(adminToken)).expect(200);
      expect(csv.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(csv.text).toContain('Group,Name,Rounds,Average score,Accuracy %');
    });

    it('most missed items respect the attempts threshold', async () => {
      const one = await request(http)
        .get('/api/admin/reports/most-missed')
        .query({ minAttempts: 1, limit: 100 })
        .set(auth(adminToken))
        .expect(200);
      expect(one.body.items.some((m: { question: { questionText: string } }) => m.question.questionText === `e2e-question-${stamp}`)).toBe(true);
      const strict = await request(http)
        .get('/api/admin/reports/most-missed')
        .query({ minAttempts: 100 })
        .set(auth(adminToken))
        .expect(200);
      expect(strict.body.items).toEqual([]);
      const csv = await request(http).get('/api/admin/reports/most-missed?format=csv').set(auth(adminToken)).expect(200);
      expect(csv.headers['content-type']).toBe('text/csv; charset=utf-8');
    });

    it('validates report parameters', async () => {
      await request(http).get('/api/admin/reports/activity').query({ format: 'xlsx' }).set(auth(adminToken)).expect(400);
      await request(http).get('/api/admin/reports/scores').query({ categoryId: 'missing' }).set(auth(adminToken)).expect(404);
    });

    it('dashboard summary', async () => {
      const res = await request(http).get('/api/admin/dashboard').set(auth(adminToken)).expect(200);
      expect(res.body.students.total).toBeGreaterThanOrEqual(res.body.students.active);
      expect(res.body.questions.active).toBeGreaterThan(0);
      expect(res.body.rounds.today).toBeGreaterThanOrEqual(1);
      expect(res.body.roundsPerDay).toHaveLength(14);
      expect(res.body.recentSessions.length).toBeGreaterThanOrEqual(1);
    });
  });
});
