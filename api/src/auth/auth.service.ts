import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, type User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { AUTH_MESSAGES, BCRYPT_ROUNDS } from './auth.constants.js';
import type { AuthResponse, JwtPayload, PublicUser } from './auth.types.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';

/**
 * Compared against when the email is unknown, so a login for a missing account
 * takes as long as one with a wrong password and response times do not reveal
 * which emails are registered.
 */
const TIMING_GUARD_HASH = bcrypt.hashSync('guessup-timing-guard', BCRYPT_ROUNDS);

/** Strips the password hash, the photo's Cloudinary id and timestamps: the only user shape the API returns. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    yearLevel: user.yearLevel,
    status: user.status,
    avatarUrl: user.avatarUrl,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /** Student self-registration. The role is always STUDENT and the status ACTIVE. */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ConflictException(AUTH_MESSAGES.emailTaken);

    try {
      const user = await this.prisma.user.create({
        data: {
          fullName: dto.fullName.trim(),
          email,
          passwordHash: await this.hashPassword(dto.password),
          yearLevel: dto.yearLevel,
          role: 'STUDENT',
          status: 'ACTIVE',
        },
      });
      return this.issue(user);
    } catch (error) {
      // Two registrations with the same email at the same moment: the unique index wins.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(AUTH_MESSAGES.emailTaken);
      }
      throw error;
    }
  }

  /**
   * Wrong email and wrong password get the same 401 message, so the response
   * does not reveal which emails exist. The deactivated check comes after the
   * password check for the same reason.
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    const passwordOk = await this.verifyPassword(dto.password, user?.passwordHash ?? TIMING_GUARD_HASH);
    if (!user || !passwordOk) throw new UnauthorizedException(AUTH_MESSAGES.invalidCredentials);
    if (user.status !== 'ACTIVE') throw new ForbiddenException(AUTH_MESSAGES.deactivated);

    return this.issue(user);
  }

  private async issue(user: User): Promise<AuthResponse> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return { accessToken: await this.jwt.signAsync(payload), user: toPublicUser(user) };
  }
}
