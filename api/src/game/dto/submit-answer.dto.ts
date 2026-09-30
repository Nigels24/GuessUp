import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ROUND_SIZE } from '../../common/game-rules.js';

/** Longest answer text accepted; the longest seeded answer is far shorter. */
export const MAX_SUBMITTED_LENGTH = 200;

/** POST /api/game/sessions/:id/answers */
export class SubmitAnswerDto {
  /**
   * The `index` of the item being answered (from the item). It makes a
   * retried or replayed request fail with 409 instead of silently answering
   * the next item.
   */
  @IsInt()
  @Min(1)
  @Max(ROUND_SIZE)
  index: number;

  /** The chosen option or the typed text. Omit it when the app's timer ran out. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SUBMITTED_LENGTH)
  submitted?: string;
}
