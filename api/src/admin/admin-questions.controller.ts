import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import {
  AdminQuestionsService,
  type AdminQuestion,
  type DeleteResult,
} from './admin-questions.service.js';
import {
  CreateQuestionDto,
  QuestionListQueryDto,
  SetQuestionActiveDto,
  UpdateQuestionDto,
} from './dto/question.dto.js';
import type { Page } from './dto/query.dto.js';

/** Admin Panel > Question Bank. */
@Roles('ADMIN')
@Controller('admin/questions')
export class AdminQuestionsController {
  constructor(private readonly questions: AdminQuestionsService) {}

  /** GET /api/admin/questions?categoryId=&difficulty=&type=&active=&search=&page=&pageSize= */
  @Get()
  list(@Query() query: QuestionListQueryDto): Promise<Page<AdminQuestion>> {
    return this.questions.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<AdminQuestion> {
    return this.questions.get(id);
  }

  /** POST /api/admin/questions — 400 with every broken rule as `message`. */
  @Post()
  create(@Body() dto: CreateQuestionDto): Promise<AdminQuestion> {
    return this.questions.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQuestionDto): Promise<AdminQuestion> {
    return this.questions.update(id, dto);
  }

  /** PATCH /api/admin/questions/:id/active — the table's Active toggle. */
  @Patch(':id/active')
  setActive(@Param('id') id: string, @Body() dto: SetQuestionActiveDto): Promise<AdminQuestion> {
    return this.questions.setActive(id, dto.isActive);
  }

  /**
   * DELETE /api/admin/questions/:id — 200 with `outcome`: DELETED, or
   * DEACTIVATED when the question has recorded answers (with the reason).
   */
  @Delete(':id')
  remove(@Param('id') id: string): Promise<DeleteResult> {
    return this.questions.remove(id);
  }
}
