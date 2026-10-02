import { Controller, Get } from '@nestjs/common';
import type { PublicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { MeService } from './me.service.js';
import type { MeSummary } from './me.summary.js';

/** The signed-in student's own data. */
@Roles('STUDENT')
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  /** GET /api/me/summary — points, rounds, badges and per-category progress (completed rounds only). */
  @Get('summary')
  summary(@CurrentUser() user: PublicUser): Promise<MeSummary> {
    return this.me.summary(user);
  }
}
