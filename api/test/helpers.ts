import type { Type } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { BCRYPT_ROUNDS } from './../src/auth/auth.constants.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/** The real app, configured like main.ts, plus any test-only controllers. */
export async function createApp(controllers: Type[] = []): Promise<NestExpressApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
    controllers,
  }).compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}

/** Every key anywhere in a JSON value (objects inside arrays included). */
export function allKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(allKeys);
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => [key, ...allKeys(child)]);
  }
  return [];
}

/** An account made for one test run: e2e-…@example.com with a random password. */
export interface TestAccount {
  id: string;
  email: string;
  password: string;
}

/**
 * Creates an ACTIVE account directly in the database, so the tests never
 * depend on the seeded demo accounts or their passwords. Delete it with
 * deleteTestAccounts in afterAll.
 */
export async function createTestAccount(
  prisma: PrismaService,
  role: 'ADMIN' | 'STUDENT',
  label: string,
): Promise<TestAccount> {
  const email = `e2e-${label}-${Date.now()}-${randomBytes(3).toString('hex')}@example.com`;
  const password = randomBytes(18).toString('base64url');
  const user = await prisma.user.create({
    data: {
      fullName: `e2e-${label}`,
      email,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      role,
      yearLevel: role === 'STUDENT' ? '1st Year' : null,
    },
  });
  return { id: user.id, email, password };
}

/** Removes test accounts and their rounds (answers, leaderboard rows and badges cascade). */
export async function deleteTestAccounts(prisma: PrismaService, emails: string[]): Promise<void> {
  await prisma.gameSession.deleteMany({ where: { user: { email: { in: emails } } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
}
