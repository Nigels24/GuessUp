import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import type { AuthResponse, PublicUser } from './auth.types.js';
import { CurrentUser } from './current-user.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { Public } from './public.decorator.js';

/**
 * Brute-force protection (Chapter II security measures): register and login
 * accept at most 5 requests per minute from one IP address; the 6th gets
 * HTTP 429 Too Many Requests. Only these two routes are throttled.
 */
const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /api/auth/register — student self-registration. */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.auth.register(dto);
  }

  /** POST /api/auth/login — students and administrators. */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.auth.login(dto);
  }

  /** GET /api/auth/me — the signed-in user, read fresh from the database. */
  @Get('me')
  me(@CurrentUser() user: PublicUser): PublicUser {
    return user;
  }
}
