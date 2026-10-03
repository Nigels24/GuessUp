import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/** POST /api/me/password — the prototype's Change password. */
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  // bcrypt only uses the first 72 bytes; longer input is refused rather than silently cut.
  @MaxLength(72)
  newPassword: string;
}
