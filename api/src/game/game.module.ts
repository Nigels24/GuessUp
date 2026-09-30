import { Module } from '@nestjs/common';
import { LeaderboardModule } from '../leaderboard/leaderboard.module.js';
import { GameController } from './game.controller.js';
import { GameService } from './game.service.js';

@Module({
  imports: [LeaderboardModule],
  controllers: [GameController],
  providers: [GameService],
})
export class GameModule {}
