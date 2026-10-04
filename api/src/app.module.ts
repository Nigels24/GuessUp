import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { GameModule } from './game/game.module.js';
import { HealthModule } from './health/health.module.js';
import { LeaderboardModule } from './leaderboard/leaderboard.module.js';
import { MeModule } from './me/me.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    HealthModule,
    CategoriesModule,
    GameModule,
    LeaderboardModule,
    MeModule,
    // The Admin Panel's routes (/api/admin/...), all @Roles('ADMIN').
    AdminModule,
  ],
})
export class AppModule {}
