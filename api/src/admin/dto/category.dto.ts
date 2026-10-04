import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { trim } from '../../auth/dto/transforms.js';
import { CATEGORY_LIMITS, CATEGORY_MESSAGES, COLOR_PATTERN, SLUG_PATTERN } from '../category.rules.js';

/** POST /api/admin/categories. Without a slug, one is made from the name. */
export class CreateCategoryDto {
  @Transform(trim)
  @IsString()
  @Length(2, CATEGORY_LIMITS.name, { message: 'The category name must be 2 to 60 characters.' })
  name: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(CATEGORY_LIMITS.slug)
  @Matches(SLUG_PATTERN, { message: CATEGORY_MESSAGES.slugInvalid })
  slug?: string;

  @Transform(trim)
  @IsString()
  @Length(1, CATEGORY_LIMITS.icon, { message: CATEGORY_MESSAGES.iconInvalid })
  icon: string;

  @Transform(trim)
  @IsString()
  @Matches(COLOR_PATTERN, { message: CATEGORY_MESSAGES.colorInvalid })
  color: string;

  @Transform(trim)
  @IsString()
  @MaxLength(CATEGORY_LIMITS.description)
  description: string;
}

/**
 * PATCH /api/admin/categories/:id. The slug cannot change: the seed and saved
 * links identify a category by it (sending one is a 400).
 */
export class UpdateCategoryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, CATEGORY_LIMITS.name, { message: 'The category name must be 2 to 60 characters.' })
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, CATEGORY_LIMITS.icon, { message: CATEGORY_MESSAGES.iconInvalid })
  icon?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(COLOR_PATTERN, { message: CATEGORY_MESSAGES.colorInvalid })
  color?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(CATEGORY_LIMITS.description)
  description?: string;
}
