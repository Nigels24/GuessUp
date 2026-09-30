import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import type { AuthResponse, PublicUser } from './auth.types.js';
import { CurrentUser } from './current-user.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { Public } from './public.decorator.js';

/**
 * Brute-force protection (Chapter II security measures). Only these two routes
 * are throttled; going over the limit returns HTTP 429 Too Many Requests.
 *
 * Register: 5 requests per minute per IP address.
 *
 * Login: 10 attempts per minute per IP address + email. The key includes the
 * email because a whole class on the school Wi-Fi shares one public IP: keyed
 * on the IP alone, one student's wrong passwords would lock out the room.
 * Guessing one account's password is still limited to 10 tries a minute.
 */
const REGISTER_THROTTLE = { default: { limit: 5, ttl: 60_000 } };
const LOGIN_THROTTLE = {
  default: {
    limit: 10,
    ttl: 60_000,
    getTracker: (req: Record<string, any>): string => {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      return `${req.ip}|${email}`;
    },
  },
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /api/auth/register — student self-registration. */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle(REGISTER_THROTTLE)
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.auth.register(dto);
  }

  /** POST /api/auth/login — students and administrators. */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle(LOGIN_THROTTLE)
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
