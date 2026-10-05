import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { trim } from '../../auth/dto/transforms.js';
import type { DifficultyKey } from '../../common/game-rules.js';
import { DIFFICULTY_KEYS } from './question.dto.js';
import { DateRangeQueryDto } from './query.dto.js';

export const SESSION_STATUSES = ['IN_PROGRESS', 'COMPLETED', 'ABANDONED'] as const;
export type SessionStatusKey = (typeof SESSION_STATUSES)[number];

/** GET /api/admin/sessions */
export class SessionListQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  studentId?: string;

  /** Student name or email contains this text. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  categoryId?: string;

  @IsOptional()
  @IsIn(DIFFICULTY_KEYS)
  difficulty?: DifficultyKey;

  @IsOptional()
  @IsIn(SESSION_STATUSES)
  status?: SessionStatusKey;
}
