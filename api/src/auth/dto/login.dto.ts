import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { normalizeEmail } from './transforms.js';

/**
 * POST /api/auth/login
 * Only presence is checked here: a malformed email simply fails to match an
 * account and gets the same "Invalid email or password." as any other miss.
 */
export class LoginDto {
  @Transform(normalizeEmail)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}
