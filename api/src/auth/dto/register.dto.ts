import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { YEAR_LEVELS, type YearLevel } from '../auth.constants.js';
import { normalizeEmail, trim } from './transforms.js';

/**
 * POST /api/auth/register
 * There is deliberately no `role` field: self-registration always creates a
 * STUDENT, and the global ValidationPipe (forbidNonWhitelisted) rejects any
 * request that tries to send one.
 */
export class RegisterDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  fullName: string;

  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(120)
  email: string;

  @IsString()
  @MinLength(8)
  // bcrypt only uses the first 72 bytes; longer input is refused rather than silently cut.
  @MaxLength(72)
  password: string;

  @IsIn(YEAR_LEVELS)
  yearLevel: YearLevel;
}
