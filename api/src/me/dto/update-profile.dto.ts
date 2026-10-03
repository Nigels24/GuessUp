import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { YEAR_LEVELS, type YearLevel } from '../../auth/auth.constants.js';
import { trim } from '../../auth/dto/transforms.js';

/**
 * PATCH /api/me — the prototype's Edit profile: full name and year level,
 * with the same limits as registration. The email and role cannot be changed
 * here; the global ValidationPipe (forbidNonWhitelisted) rejects them.
 */
export class UpdateProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  fullName?: string;

  @IsOptional()
  @IsIn(YEAR_LEVELS)
  yearLevel?: YearLevel;
}
