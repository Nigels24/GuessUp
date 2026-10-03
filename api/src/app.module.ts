import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
    // Next steps add QuestionsModule and
    // ReportsModule. AuthModule's global guard protects every route they add
    // unless it is marked @Public().
  ],
})
export class AppModule {}
