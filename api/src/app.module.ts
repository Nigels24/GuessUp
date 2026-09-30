import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    // Step 2 adds AuthModule, then CategoriesModule, QuestionsModule,
    // GameModule, LeaderboardModule and ReportsModule.
  ],
})
export class AppModule {}
