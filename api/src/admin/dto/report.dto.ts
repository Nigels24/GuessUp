import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { DAY_MESSAGE, DAY_PATTERN } from './query.dto.js';

/** ?from=&to=&categoryId=&format=csv on every report. */
export class ReportQueryDto {
  @IsOptional()
  @Matches(DAY_PATTERN, { message: DAY_MESSAGE })
  from?: string;

  @IsOptional()
  @Matches(DAY_PATTERN, { message: DAY_MESSAGE })
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  categoryId?: string;

  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv';
}

/** GET /api/admin/reports/most-missed adds the attempts threshold and the list length. */
export class MostMissedQueryDto extends ReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  minAttempts?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
