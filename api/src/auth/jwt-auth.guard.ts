import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { AUTH_MESSAGES } from './auth.constants.js';
import { toPublicUser } from './auth.service.js';
import type { JwtPayload, PublicUser } from './auth.types.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

/**
 * Registered globally in AuthModule: every route needs a valid bearer token
 * unless it is marked @Public().
 *
 * The user is re-read from the database on every request instead of trusting
 * the token alone, so deactivating a student in the Admin Panel ends their
 * access on their very next request (Chapter III).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: PublicUser }>();
    const token = extractBearerToken(request);
    if (!token) throw new UnauthorizedException(AUTH_MESSAGES.signInRequired);

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException(AUTH_MESSAGES.signInRequired);
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException(AUTH_MESSAGES.signInRequired);
    if (user.status !== 'ACTIVE') throw new ForbiddenException(AUTH_MESSAGES.deactivated);

    request.user = toPublicUser(user);
    return true;
  }
}

function extractBearerToken(request: Request): string | null {
  const [scheme, token] = (request.headers.authorization ?? '').split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}
