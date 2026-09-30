import { Controller, Get } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { Roles } from './../src/auth/roles.decorator.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * End-to-end checks for the health and auth endpoints.
 * Needs a reachable, seeded DATABASE_URL and JWT_SECRET, so run it with the
 * database up:
 *   npm run test:e2e
 */

/** Test-only route guarded like the admin endpoints of later steps. */
@Controller('e2e-admin-only')
class AdminOnlyController {
  @Roles('ADMIN')
  @Get()
  ok(): { ok: true } {
    return { ok: true };
  }
}

async function createApp(): Promise<NestExpressApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [AdminOnlyController],
  }).compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}

const STUDENT = { email: 'student@jhcsc.edu.ph', password: 'student123' };
const ADMIN = { email: 'admin@jhcsc.edu.ph', password: 'admin123' };

describe('GuessUp API (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let prisma: PrismaService;
  const throwawayEmail = `e2e-${Date.now()}@example.com`;

  beforeAll(async () => {
    app = await createApp();
    http = app.getHttpServer() as App;
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: throwawayEmail } });
    await app.close();
  });

  it('/api/health (GET) is public', () => {
    return request(http)
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        if (res.body.status !== 'ok') throw new Error('status is not ok');
        if (res.body.db !== 'up') throw new Error('database is not reachable');
      });
  });

  describe('register', () => {
    it('creates an ACTIVE STUDENT and returns a token', async () => {
      const res = await request(http)
        .post('/api/auth/register')
        .send({
          fullName: 'E2E Throwaway',
          email: `  ${throwawayEmail.toUpperCase()} `,
          password: 'longenough',
          yearLevel: '1st Year',
        })
        .expect(201);

      expect(res.body.accessToken).toBeTypeOf('string');
      expect(res.body.user).toMatchObject({
        fullName: 'E2E Throwaway',
        email: throwawayEmail,
        role: 'STUDENT',
        yearLevel: '1st Year',
        status: 'ACTIVE',
      });
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('rejects a duplicate email with 409', async () => {
      const res = await request(http)
        .post('/api/auth/register')
        .send({ fullName: 'Again', email: throwawayEmail, password: 'longenough', yearLevel: '1st Year' })
        .expect(409);
      expect(res.body.message).toBe('That email is already registered.');
    });

    it('does not let the caller choose a role', async () => {
      await request(http)
        .post('/api/auth/register')
        .send({
          fullName: 'Sneaky',
          email: `sneaky-${throwawayEmail}`,
          password: 'longenough',
          yearLevel: '1st Year',
          role: 'ADMIN',
        })
        .expect(400);
    });
  });

  describe('login and /me', () => {
    let studentToken: string;

    it('logs in the seeded student', async () => {
      const res = await request(http).post('/api/auth/login').send(STUDENT).expect(200);
      studentToken = res.body.accessToken;
      expect(studentToken).toBeTypeOf('string');
      expect(res.body.user).toMatchObject({ email: STUDENT.email, role: 'STUDENT' });
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('rejects a wrong password with the generic message', async () => {
      const res = await request(http)
        .post('/api/auth/login')
        .send({ ...STUDENT, password: 'not-the-password' })
        .expect(401);
      expect(res.body.message).toBe('Invalid email or password.');
    });

    it('/api/auth/me returns the user for a valid token', async () => {
      const res = await request(http)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body).toMatchObject({ email: STUDENT.email, role: 'STUDENT', status: 'ACTIVE' });
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('/api/auth/me rejects a missing or forged token', async () => {
      await request(http).get('/api/auth/me').expect(401);
      await request(http).get('/api/auth/me').set('Authorization', 'Bearer not.a.jwt').expect(401);
    });

    it('a student token is refused by an @Roles("ADMIN") route; an admin token is accepted', async () => {
      await request(http)
        .get('/api/e2e-admin-only')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);

      const admin = await request(http).post('/api/auth/login').send(ADMIN).expect(200);
      await request(http)
        .get('/api/e2e-admin-only')
        .set('Authorization', `Bearer ${admin.body.accessToken}`)
        .expect(200);
    });

    it('deactivating an account ends its access on the next request', async () => {
      const login = await request(http)
        .post('/api/auth/login')
        .send({ email: throwawayEmail, password: 'longenough' })
        .expect(200);
      await prisma.user.update({ where: { email: throwawayEmail }, data: { status: 'INACTIVE' } });

      const deactivated = 'This account is deactivated. Please contact your instructor.';
      const me = await request(http)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(403);
      expect(me.body.message).toBe(deactivated);
    });
  });

  it('throttles login at 10 attempts per minute per IP + email, without locking out other emails', async () => {
    // A fresh app, so the attempts above do not count towards the limit.
    const fresh = await createApp();
    try {
      const server = fresh.getHttpServer() as App;
      // Same email typed differently still counts as one key.
      const bad = (email: string) => ({ email, password: 'brute-force-guess' });
      for (let i = 0; i < 10; i++) {
        const email = i % 2 ? ADMIN.email : `  ${ADMIN.email.toUpperCase()} `;
        await request(server).post('/api/auth/login').send(bad(email)).expect(401);
      }
      const blocked = await request(server).post('/api/auth/login').send(bad(ADMIN.email)).expect(429);
      expect(blocked.body.message).toBe('Too many attempts. Please wait a minute and try again.');

      // A classmate on the same IP (same Wi-Fi) can still sign in.
      await request(server).post('/api/auth/login').send(STUDENT).expect(200);
    } finally {
      await fresh.close();
    }
  });

  it('throttles register at 5 requests per minute per IP', async () => {
    const fresh = await createApp();
    try {
      const server = fresh.getHttpServer() as App;
      // Invalid bodies (400) still count, so no accounts are created.
      for (let i = 0; i < 5; i++) {
        await request(server).post('/api/auth/register').send({ email: `x${i}` }).expect(400);
      }
      await request(server).post('/api/auth/register').send({ email: 'x6' }).expect(429);
    } finally {
      await fresh.close();
    }
  });
});
