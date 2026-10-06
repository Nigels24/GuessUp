import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { App } from 'supertest/types';
import { ANSWER_GRACE_SECONDS, LEVELS, ROUND_SIZE, type DifficultyKey } from './../src/common/game-rules.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { allKeys, createApp, createTestAccount, deleteTestAccounts, type TestAccount } from './helpers.js';

/**
 * Every seeded category at every difficulty, played the way the app plays it:
 * the hint, a correct answer, a wrong one, "I don't know", a timeout, finish
 * and the result. Each category must answer with the same shapes, so the app
 * never meets an item it cannot draw or an error that ends the round.
 *   npm run test:e2e
 */

const DIFFICULTIES: DifficultyKey[] = ['EASY', 'AVERAGE', 'DIFFICULT'];
const ANSWER_KEYS = ['answer', 'alternates', 'explanation', 'correctAnswer'];
const ITEM_KEYS: Record<string, string[]> = {
  MULTIPLE_CHOICE: ['choices', 'codeSnippet', 'difficulty', 'imageUrl', 'index', 'questionText', 'type'],
  PICTURE: ['codeSnippet', 'difficulty', 'imageUrl', 'index', 'questionText', 'type'],
  WORD_PUZZLE: [
    'answerLength',
    'codeSnippet',
    'difficulty',
    'imageUrl',
    'index',
    'questionText',
    'scrambledLetters',
    'type',
    'wordLengths',
  ],
};

describe('Every category and level plays to the end (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let prisma: PrismaService;
  let student: TestAccount;
  let token: string;
  let categories: { id: string; slug: string }[];

  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = await createApp();
    http = app.getHttpServer() as App;
    prisma = app.get(PrismaService);
    student = await createTestAccount(prisma, 'STUDENT', 'every-category');
    const login = await request(http)
      .post('/api/auth/login')
      .send({ email: student.email, password: student.password })
      .expect(200);
    token = login.body.accessToken;
    const res = await request(http).get('/api/categories').set(auth()).expect(200);
    categories = res.body;
  });

  afterAll(async () => {
    if (prisma && student) await deleteTestAccounts(prisma, [student.email]);
    await app?.close();
  }, 60_000);

  for (const difficulty of DIFFICULTIES) {
    it(`plays a ${difficulty} round in each of the 7 seeded categories`, async () => {
      const level = LEVELS[difficulty];
      const failures: string[] = [];
      /** Runs a request and notes any status other than the expected one. */
      const call = async (label: string, req: request.Test, expected: number) => {
        const res = await req;
        if (res.status !== expected) failures.push(`${label}: ${res.status} ${JSON.stringify(res.body)}`);
        return res;
      };

      expect(categories.map((c) => c.slug).sort()).toEqual(
        ['dbms', 'dsa', 'ias', 'net', 'prog', 'sad', 'web'],
      );

      for (const category of categories) {
        const tag = `${category.slug}/${difficulty}`;
        const start = await call(
          `${tag} start`,
          request(http).post('/api/game/sessions').set(auth()).send({ categoryId: category.id, difficulty }),
          201,
        );
        if (start.status !== 201) continue;
        const sessionId: string = start.body.sessionId;
        let state = start.body;

        for (let index = 1; index <= ROUND_SIZE; index++) {
          if (index > 1) {
            const current = await call(
              `${tag} #${index} current`,
              request(http).get(`/api/game/sessions/${sessionId}/current`).set(auth()),
              200,
            );
            state = current.body;
          }
          const item = state.item;
          expect(item.index, tag).toBe(index);
          expect(Object.keys(item).sort(), `${tag} #${index} ${item.type}`).toEqual(ITEM_KEYS[item.type]);
          for (const key of ANSWER_KEYS) expect(allKeys(state), `${tag} leaks ${key}`).not.toContain(key);
          if (item.type === 'PICTURE') expect(item.imageUrl, `${tag} #${index} picture`).toBeTruthy();
          if (item.type === 'MULTIPLE_CHOICE') expect(item.choices.length, tag).toBeGreaterThanOrEqual(2);
          if (item.type === 'WORD_PUZZLE') {
            expect(item.scrambledLetters, tag).toHaveLength(item.answerLength);
            expect(item.wordLengths.reduce((a: number, b: number) => a + b, 0), tag).toBe(item.answerLength);
          }

          if (index === 1 && level.hints) {
            const hint = await call(
              `${tag} #1 hint`,
              request(http).post(`/api/game/sessions/${sessionId}/hint`).set(auth()),
              200,
            );
            expect(typeof hint.body.hint, tag).toBe('string');
          }

          const question = await prisma.question.findFirstOrThrow({
            where: { id: (await prisma.gameSession.findUniqueOrThrow({ where: { id: sessionId } })).itemIds[index - 1] },
          });
          // 1 and 5 correct, 2 wrong, 3 "I don't know", 4 timeout.
          let body: object = {};
          if (index === 1 || index === 5) body = { submitted: question.answer };
          if (index === 2) body = { submitted: 'definitely not the answer' };
          if (index === 4) {
            await prisma.gameSession.update({
              where: { id: sessionId },
              data: { currentServedAt: new Date(Date.now() - (level.seconds + ANSWER_GRACE_SECONDS + 5) * 1000) },
            });
          }
          const answer = await call(
            `${tag} #${index} answer`,
            request(http).post(`/api/game/sessions/${sessionId}/answers`).set(auth()).send({ index, ...body }),
            200,
          );
          expect(answer.body.isLastItem, tag).toBe(index === ROUND_SIZE);
          expect(answer.body.isCorrect, `${tag} #${index}`).toBe(index === 1 || index === 5);
          expect(answer.body.timedOut, `${tag} #${index}`).toBe(index === 4);
        }

        // As the app does after the last item: /current is 409 (nothing left), then finish.
        await call(`${tag} current after last`, request(http).get(`/api/game/sessions/${sessionId}/current`).set(auth()), 409);
        const finish = await call(`${tag} finish`, request(http).post(`/api/game/sessions/${sessionId}/finish`).set(auth()), 200);
        expect(finish.body.review, tag).toHaveLength(ROUND_SIZE);
        await call(`${tag} result`, request(http).get(`/api/game/sessions/${sessionId}`).set(auth()), 200);
        await call(`${tag} leaderboard`, request(http).get(`/api/leaderboard/${category.id}`).set(auth()), 200);
      }

      expect(failures).toEqual([]);
    }, 240_000);
  }
});
