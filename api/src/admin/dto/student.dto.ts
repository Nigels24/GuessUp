import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { trim } from '../../auth/dto/transforms.js';
import { YEAR_LEVELS, type YearLevel } from '../../auth/auth.constants.js';
import { PageQueryDto } from './query.dto.js';

export const USER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type UserStatusKey = (typeof USER_STATUSES)[number];

/** GET /api/admin/students */
export class StudentListQueryDto extends PageQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(YEAR_LEVELS)
  yearLevel?: YearLevel;

  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: UserStatusKey;
}

/** PATCH /api/admin/students/:id/status */
export class SetStudentStatusDto {
  @IsIn(USER_STATUSES, { message: 'Status must be ACTIVE or INACTIVE.' })
  status: UserStatusKey;
}
