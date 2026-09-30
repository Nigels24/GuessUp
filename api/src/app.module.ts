import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    HealthModule,
    // Next steps add CategoriesModule, QuestionsModule, GameModule,
    // LeaderboardModule and ReportsModule. AuthModule's global guard protects
    // every route they add unless it is marked @Public().
  ],
})
export class AppModule {}
