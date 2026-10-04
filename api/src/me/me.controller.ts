import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { PublicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { MeProgress } from './me.progress.js';
import { MeService } from './me.service.js';
import type { MeSummary } from './me.summary.js';

/**
 * Change password: 10 attempts per minute per account, so a stolen token
 * cannot be used to guess the current password quickly. The global guards run
 * first, so the signed-in user is known here.
 */
const PASSWORD_THROTTLE = {
  default: {
    limit: 10,
    ttl: 60_000,
    getTracker: (req: Record<string, any>): string => `password|${req.user?.id ?? req.ip}`,
  },
};

/**
 * The signed-in user's own data. Progress is for students; the profile and
 * password routes serve students (app) and administrators (panel's My account).
 */
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  /** GET /api/me/summary — points, rounds, badges and per-category progress (completed rounds only). */
  @Roles('STUDENT')
  @Get('summary')
  summary(@CurrentUser() user: PublicUser): Promise<MeSummary> {
    return this.me.summary(user);
  }

  /** GET /api/me/progress — the My Progress screen (completed rounds only). */
  @Roles('STUDENT')
  @Get('progress')
  progress(@CurrentUser() user: PublicUser): Promise<MeProgress> {
    return this.me.progress(user);
  }

  /** PATCH /api/me — Edit profile (full name; students also year level). */
  @Roles('STUDENT', 'ADMIN')
  @Patch()
  update(@CurrentUser() user: PublicUser, @Body() dto: UpdateProfileDto): Promise<PublicUser> {
    return this.me.updateProfile(user, dto);
  }

  /** POST /api/me/password — Change password. 204 on success. */
  @Roles('STUDENT', 'ADMIN')
  @UseGuards(ThrottlerGuard)
  @Throttle(PASSWORD_THROTTLE)
  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(@CurrentUser() user: PublicUser, @Body() dto: ChangePasswordDto): Promise<void> {
    return this.me.changePassword(user, dto);
  }
}
