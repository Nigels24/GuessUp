import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { trim } from '../../auth/dto/transforms.js';
import { LEVELS, type DifficultyKey, type QuestionTypeKey } from '../../common/game-rules.js';
import { QUESTION_LIMITS as L } from '../question.rules.js';
import { PageQueryDto } from './query.dto.js';

export const QUESTION_TYPES: QuestionTypeKey[] = ['MULTIPLE_CHOICE', 'PICTURE', 'WORD_PUZZLE'];
export const DIFFICULTY_KEYS = Object.keys(LEVELS) as DifficultyKey[];

/**
 * POST /api/admin/questions. Shape only; the per-type rules (choices, image,
 * puzzle letters, hints) are in question.rules.ts so they can be unit tested.
 */
export class CreateQuestionDto {
  @IsString()
  @MaxLength(64)
  categoryId: string;

  @IsIn(QUESTION_TYPES, { message: 'Choose a question type.' })
  type: QuestionTypeKey;

  @IsIn(DIFFICULTY_KEYS, { message: 'Choose a difficulty level.' })
  difficulty: DifficultyKey;

  @IsString()
  @MaxLength(L.questionText)
  questionText: string;

  @IsOptional()
  @IsString()
  @MaxLength(L.codeSnippet)
  codeSnippet?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(L.imageUrl)
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  imagePublicId?: string | null;

  @IsString()
  @MaxLength(L.answer)
  answer: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(L.alternate, { each: true })
  alternates?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(L.choice, { each: true })
  choices?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(L.hint)
  hint?: string | null;

  @IsString()
  @MaxLength(L.explanation)
  explanation: string;

  @IsOptional()
  @IsString()
  @MaxLength(L.topic)
  topic?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** PATCH /api/admin/questions/:id: any fields; the merged item is checked again. */
export class UpdateQuestionDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  categoryId?: string;

  @IsOptional()
  @IsIn(QUESTION_TYPES, { message: 'Choose a question type.' })
  type?: QuestionTypeKey;

  @IsOptional()
  @IsIn(DIFFICULTY_KEYS, { message: 'Choose a difficulty level.' })
  difficulty?: DifficultyKey;

  @IsOptional()
  @IsString()
  @MaxLength(L.questionText)
  questionText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(L.codeSnippet)
  codeSnippet?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(L.imageUrl)
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  imagePublicId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(L.answer)
  answer?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(L.alternate, { each: true })
  alternates?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(L.choice, { each: true })
  choices?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(L.hint)
  hint?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(L.explanation)
  explanation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(L.topic)
  topic?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** PATCH /api/admin/questions/:id/active */
export class SetQuestionActiveDto {
  @IsBoolean()
  isActive: boolean;
}

/** GET /api/admin/questions */
export class QuestionListQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  categoryId?: string;

  @IsOptional()
  @IsIn(DIFFICULTY_KEYS)
  difficulty?: DifficultyKey;

  @IsOptional()
  @IsIn(QUESTION_TYPES)
  type?: QuestionTypeKey;

  /** "true" = active only, "false" = inactive only. */
  @IsOptional()
  @IsIn(['true', 'false'])
  active?: 'true' | 'false';

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;
}
