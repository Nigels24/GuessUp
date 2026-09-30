import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AUTH_MESSAGES } from './auth.constants.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) throw new Error('JWT_SECRET is not set. Copy api/.env.example to api/.env.');
        return {
          secret,
          signOptions: {
            expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d') as JwtSignOptions['expiresIn'],
          },
        };
      },
    }),
    // Limits are set per route with @Throttle in AuthController; the guard is
    // not global, so only the routes that opt in are throttled.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', limit: 5, ttl: 60_000 }],
      errorMessage: AUTH_MESSAGES.tooManyAttempts,
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Order matters: authentication first, then the role check.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
