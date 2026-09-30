import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { LEVELS, type DifficultyKey } from '../../common/game-rules.js';

/** POST /api/game/sessions */
export class StartSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  categoryId: string;

  @IsIn(Object.keys(LEVELS))
  difficulty: DifficultyKey;
}
