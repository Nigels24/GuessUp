import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { PublicUser } from './auth.types.js';

/** The signed-in user, loaded from the database by JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PublicUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: PublicUser }>();
    return request.user;
  },
);
