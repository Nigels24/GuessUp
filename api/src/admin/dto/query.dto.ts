import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const DAY_MESSAGE = 'Dates must be written as YYYY-MM-DD.';

/** ?page=&pageSize= on the Admin Panel's paginated lists. */
export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

/** A page of a list, with the total number of matching rows. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function pageOf(query: PageQueryDto, defaultSize: number) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? defaultSize;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/** ?from=YYYY-MM-DD&to=YYYY-MM-DD (Philippine calendar days, both inclusive). */
export class DateRangeQueryDto extends PageQueryDto {
  @IsOptional()
  @Matches(DAY_PATTERN, { message: DAY_MESSAGE })
  from?: string;

  @IsOptional()
  @Matches(DAY_PATTERN, { message: DAY_MESSAGE })
  to?: string;
}
