import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import type { Request } from 'express';
import { AUTH_MESSAGES } from './auth.constants.js';
import type { PublicUser } from './auth.types.js';
import { ROLES_KEY } from './roles.decorator.js';

/**
 * Runs after JwtAuthGuard (both are global, registered in that order). Routes
 * without @Roles() are open to any signed-in user.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const { user } = context.switchToHttp().getRequest<Request & { user?: PublicUser }>();
    if (!user || !roles.includes(user.role)) throw new ForbiddenException(AUTH_MESSAGES.forbidden);
    return true;
  }
}
