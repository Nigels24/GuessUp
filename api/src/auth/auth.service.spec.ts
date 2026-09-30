import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AUTH_MESSAGES } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import type { JwtPayload } from './auth.types.js';

const SECRET = 'unit-test-secret';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user_1',
    fullName: 'Juan Dela Cruz',
    email: 'student@jhcsc.edu.ph',
    passwordHash: bcrypt.hashSync('student123', 10),
    role: 'STUDENT',
    yearLevel: '3rd Year',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  const findUnique = vi.fn();
  const create = vi.fn();
  const prisma = { user: { findUnique, create } } as unknown as PrismaService;
  const jwt = new JwtService({ secret: SECRET, signOptions: { expiresIn: '7d' } });
  const service = new AuthService(prisma, jwt);

  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset();
  });

  describe('password hashing', () => {
    it('hashes with bcrypt cost 10 and never stores the plain password', async () => {
      const hash = await service.hashPassword('student123');
      expect(hash).not.toContain('student123');
      expect(bcrypt.getRounds(hash)).toBe(10);
    });

    it('accepts the right password and rejects a wrong one', async () => {
      const hash = await service.hashPassword('student123');
      expect(await service.verifyPassword('student123', hash)).toBe(true);
      expect(await service.verifyPassword('student124', hash)).toBe(false);
    });
  });

  describe('register', () => {
    const dto = {
      fullName: '  Maria Santos ',
      email: '  Maria.Santos@JHCSC.edu.ph ',
      password: 'longenough',
      yearLevel: '4th Year' as const,
    };

    it('creates an ACTIVE STUDENT with a lowercased email and a hashed password', async () => {
      findUnique.mockResolvedValue(null);
      create.mockImplementation(({ data }) => Promise.resolve(makeUser({ id: 'new_1', ...data })));

      const result = await service.register(dto);

      const data = create.mock.calls[0][0].data;
      expect(data.email).toBe('maria.santos@jhcsc.edu.ph');
      expect(data.fullName).toBe('Maria Santos');
      expect(data.role).toBe('STUDENT');
      expect(data.status).toBe('ACTIVE');
      expect(await bcrypt.compare('longenough', data.passwordHash)).toBe(true);
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user.role).toBe('STUDENT');
      expect(result.accessToken).toBeTypeOf('string');
    });

    it('rejects a duplicate email with 409', async () => {
      findUnique.mockResolvedValue({ id: 'existing' });
      const attempt = service.register(dto);
      await expect(attempt).rejects.toBeInstanceOf(ConflictException);
      await expect(attempt).rejects.toThrow(AUTH_MESSAGES.emailTaken);
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns a token whose payload holds sub, email and role, and a user without the hash', async () => {
      const user = makeUser();
      findUnique.mockResolvedValue(user);

      const result = await service.login({ email: ' Student@JHCSC.edu.ph', password: 'student123' });

      expect(findUnique).toHaveBeenCalledWith({ where: { email: 'student@jhcsc.edu.ph' } });
      expect(result.user).toEqual({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: 'STUDENT',
        yearLevel: '3rd Year',
        status: 'ACTIVE',
      });
      const payload = await jwt.verifyAsync<JwtPayload & { exp: number }>(result.accessToken);
      expect(payload).toMatchObject({ sub: user.id, email: user.email, role: 'STUDENT' });
      expect(payload.exp).toBeGreaterThan(Date.now() / 1000);
    });

    it('rejects a wrong password with the generic 401 message', async () => {
      findUnique.mockResolvedValue(makeUser());
      const attempt = service.login({ email: 'student@jhcsc.edu.ph', password: 'wrong-pass' });
      await expect(attempt).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(attempt).rejects.toThrow('Invalid email or password.');
    });

    it('rejects an unknown email with the very same message', async () => {
      findUnique.mockResolvedValue(null);
      const attempt = service.login({ email: 'nobody@jhcsc.edu.ph', password: 'student123' });
      await expect(attempt).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(attempt).rejects.toThrow('Invalid email or password.');
    });

    it('rejects a deactivated account with 403', async () => {
      findUnique.mockResolvedValue(makeUser({ status: 'INACTIVE' }));
      const attempt = service.login({ email: 'student@jhcsc.edu.ph', password: 'student123' });
      await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
      await expect(attempt).rejects.toThrow(
        'This account is deactivated. Please contact your instructor.',
      );
    });

    it('does not reveal that a deactivated account exists when the password is wrong', async () => {
      findUnique.mockResolvedValue(makeUser({ status: 'INACTIVE' }));
      const attempt = service.login({ email: 'student@jhcsc.edu.ph', password: 'wrong-pass' });
      await expect(attempt).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
