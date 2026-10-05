import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { PublicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { MAX_AVATAR_BYTES } from './avatar.rules.js';
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

/** Profile photo uploads and removals: 10 per minute per account, like the password. */
const AVATAR_THROTTLE = {
  default: {
    limit: 10,
    ttl: 60_000,
    getTracker: (req: Record<string, any>): string => `avatar|${req.user?.id ?? req.ip}`,
  },
};

/** The part of multer's file object the photo upload uses (kept in memory, never on disk). */
interface UploadedPhotoFile {
  buffer: Buffer;
  size: number;
}

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

  /** GET /api/me — the signed-in user (same as GET /api/auth/me). */
  @Roles('STUDENT', 'ADMIN')
  @Get()
  get(@CurrentUser() user: PublicUser): PublicUser {
    return user;
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

  /**
   * POST /api/me/avatar (multipart, field "file") -> the updated user.
   * Students only. JPG, PNG or WebP up to 2 MB; Cloudinary stores it as a
   * 512×512 square. Replaces (and deletes) the previous photo. 503 when
   * Cloudinary is not configured on the server.
   */
  @Roles('STUDENT')
  @UseGuards(ThrottlerGuard)
  @Throttle(AVATAR_THROTTLE)
  @Post('avatar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    // Multer's own cap is looser so a slightly larger file gets the friendly 2 MB message.
    FileInterceptor('file', { limits: { fileSize: MAX_AVATAR_BYTES * 2, files: 1 } }),
  )
  uploadAvatar(@CurrentUser() user: PublicUser, @UploadedFile() file?: UploadedPhotoFile): Promise<PublicUser> {
    return this.me.uploadAvatar(user, file);
  }

  /** DELETE /api/me/avatar — back to the initials. 204, also when there was no photo. */
  @Roles('STUDENT')
  @UseGuards(ThrottlerGuard)
  @Throttle(AVATAR_THROTTLE)
  @Delete('avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAvatar(@CurrentUser() user: PublicUser): Promise<void> {
    return this.me.removeAvatar(user);
  }
}
