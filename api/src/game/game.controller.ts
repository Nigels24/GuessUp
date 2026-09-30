import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import type { PublicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { HISTORY_DEFAULT_LIMIT, HistoryQueryDto } from './dto/history-query.dto.js';
import { StartSessionDto } from './dto/start-session.dto.js';
import { SubmitAnswerDto } from './dto/submit-answer.dto.js';
import { GameService } from './game.service.js';
import type {
  AnswerResult,
  FinishResult,
  HistoryEntry,
  RoundState,
  SessionResult,
} from './game.types.js';

/** Gameplay. Students only, except reading a finished round, which an administrator may do. */
@Roles('STUDENT')
@Controller('game')
export class GameController {
  constructor(private readonly game: GameService) {}

  /** POST /api/game/sessions — start a round (abandons any unfinished one). */
  @Post('sessions')
  start(@CurrentUser() user: PublicUser, @Body() dto: StartSessionDto): Promise<RoundState> {
    return this.game.start(user, dto);
  }

  /** GET /api/game/sessions/:id/current — re-send the current item (app restarted mid-round). */
  @Get('sessions/:id/current')
  current(@CurrentUser() user: PublicUser, @Param('id') id: string): Promise<RoundState> {
    return this.game.current(user, id);
  }

  /** POST /api/game/sessions/:id/hint */
  @Post('sessions/:id/hint')
  @HttpCode(HttpStatus.OK)
  hint(@CurrentUser() user: PublicUser, @Param('id') id: string): Promise<{ hint: string }> {
    return this.game.hint(user, id);
  }

  /** POST /api/game/sessions/:id/answers */
  @Post('sessions/:id/answers')
  @HttpCode(HttpStatus.OK)
  answer(
    @CurrentUser() user: PublicUser,
    @Param('id') id: string,
    @Body() dto: SubmitAnswerDto,
  ): Promise<AnswerResult> {
    return this.game.answer(user, id, dto);
  }

  /** POST /api/game/sessions/:id/finish */
  @Post('sessions/:id/finish')
  @HttpCode(HttpStatus.OK)
  finish(@CurrentUser() user: PublicUser, @Param('id') id: string): Promise<FinishResult> {
    return this.game.finish(user, id);
  }

  /** POST /api/game/sessions/:id/abandon — the prototype's "Quit round". */
  @Post('sessions/:id/abandon')
  @HttpCode(HttpStatus.OK)
  abandon(
    @CurrentUser() user: PublicUser,
    @Param('id') id: string,
  ): Promise<{ sessionId: string; status: 'ABANDONED' }> {
    return this.game.abandon(user, id);
  }

  /** GET /api/game/sessions/:id — a finished round's result and review (owner or administrator). */
  @Roles('STUDENT', 'ADMIN')
  @Get('sessions/:id')
  get(@CurrentUser() user: PublicUser, @Param('id') id: string): Promise<SessionResult> {
    return this.game.get(user, id);
  }

  /** GET /api/game/history?limit=20 — the student's finished rounds, newest first. */
  @Get('history')
  history(@CurrentUser() user: PublicUser, @Query() query: HistoryQueryDto): Promise<HistoryEntry[]> {
    return this.game.history(user, query.limit ?? HISTORY_DEFAULT_LIMIT);
  }
}
