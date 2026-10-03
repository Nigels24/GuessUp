import { Controller, Get, Param } from '@nestjs/common';
import type { PublicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { LeaderboardService, type Leaderboard } from './leaderboard.service.js';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  /** GET /api/leaderboard/:categoryId — any signed-in user. Rankings are per category only. */
  @Get(':categoryId')
  board(@CurrentUser() user: PublicUser, @Param('categoryId') categoryId: string): Promise<Leaderboard> {
    return this.leaderboard.board(categoryId, user.id);
  }
}
