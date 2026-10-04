import { Controller, Get } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { App } from 'supertest/types';
import { Roles } from './../src/auth/roles.decorator.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createApp, createTestAccount, deleteTestAccounts, type TestAccount } from './helpers.js';

/**
 * End-to-end checks for the health and auth endpoints.
 * Needs a reachable, seeded DATABASE_URL and JWT_SECRET, so run it with the
 * database up. It makes its own student and administrator (random passwords)
 * instead of using the seeded demo accounts:
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


describe('GuessUp API (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let prisma: PrismaService;
  const stamp = Date.now();
  const throwawayEmail = `e2e-${stamp}@example.com`;
  /** Must be refused; listed in the cleanup in case that ever regresses. */
  const sneakyEmail = `e2e-sneaky-${stamp}@example.com`;

  let STUDENT: { email: string; password: string };
  let ADMIN: { email: string; password: string };
  const accounts: TestAccount[] = [];

  beforeAll(async () => {
    app = await createApp([AdminOnlyController]);
    http = app.getHttpServer() as App;
    prisma = app.get(PrismaService);
    for (const [role, label] of [['STUDENT', 'auth-student'], ['ADMIN', 'auth-admin']] as const) {
      accounts.push(await createTestAccount(prisma, role, label));
    }
    STUDENT = { email: accounts[0]!.email, password: accounts[0]!.password };
    ADMIN = { email: accounts[1]!.email, password: accounts[1]!.password };
  }, 60_000);

  afterAll(async () => {
    // Everything this file registers uses an e2e-...@example.com address with this run's stamp.
    if (prisma) {
      await deleteTestAccounts(prisma, [throwawayEmail, sneakyEmail, ...accounts.map((a) => a.email)]);
    }
    await app?.close();
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
          fullName: 'e2e-throwaway',
          email: `  ${throwawayEmail.toUpperCase()} `,
          password: 'longenough',
          yearLevel: '1st Year',
        })
        .expect(201);

      expect(res.body.accessToken).toBeTypeOf('string');
      expect(res.body.user).toMatchObject({
        fullName: 'e2e-throwaway',
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
        .send({ fullName: 'e2e-again', email: throwawayEmail, password: 'longenough', yearLevel: '1st Year' })
        .expect(409);
      expect(res.body.message).toBe('That email is already registered.');
    });

    it('does not let the caller choose a role', async () => {
      await request(http)
        .post('/api/auth/register')
        .send({
          fullName: 'e2e-sneaky',
          email: sneakyEmail,
          password: 'longenough',
          yearLevel: '1st Year',
          role: 'ADMIN',
        })
        .expect(400);
    });
  });

  describe('login and /me', () => {
    let studentToken: string;

    it('logs in a student', async () => {
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
  describe('npm run admin:set-password (scripts/set-admin-password.ts)', () => {
    const run = (env: Record<string, string>) =>
      promisify(execFile)('npx', ['tsx', 'scripts/set-admin-password.ts'], {
        cwd: process.cwd(),
        env: { ...process.env, ...env },
      }).then(
        (r) => ({ code: 0, out: r.stdout + r.stderr }),
        (e: { code: number; stdout: string; stderr: string }) => ({ code: e.code, out: e.stdout + e.stderr }),
      );

    it('changes only an administrator password, never printing it', async () => {
      const admin = await createTestAccount(prisma, 'ADMIN', 'script-admin');
      accounts.push(admin);
      const newPassword = `e2e-${Date.now()}-new-pass`;

      const short = await run({ ADMIN_EMAIL: admin.email, NEW_ADMIN_PASSWORD: 'short' });
      expect(short.code).toBe(1);
      expect(short.out).toContain('at least 10 characters');

      const student = await run({ ADMIN_EMAIL: STUDENT.email, NEW_ADMIN_PASSWORD: newPassword });
      expect(student.code).toBe(1);
      expect(student.out).toContain('is not an administrator account');
      await request(http).post('/api/auth/login').send(STUDENT).expect(200);

      const ok = await run({ ADMIN_EMAIL: admin.email.toUpperCase(), NEW_ADMIN_PASSWORD: newPassword });
      expect(ok.code).toBe(0);
      expect(ok.out).toContain(`Success: the password of ${admin.email} was changed.`);
      expect(ok.out).not.toContain(newPassword);

      await request(http).post('/api/auth/login').send({ email: admin.email, password: admin.password }).expect(401);
      await request(http).post('/api/auth/login').send({ email: admin.email, password: newPassword }).expect(200);
    }, 120_000);
  });
});
