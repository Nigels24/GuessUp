import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { AdminCategoriesService, type AdminCategory } from './admin-categories.service.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';

/** Admin Panel > Categories. */
@Roles('ADMIN')
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categories: AdminCategoriesService) {}

  /** GET /api/admin/categories — with question counts per difficulty and session counts. */
  @Get()
  list(): Promise<AdminCategory[]> {
    return this.categories.list();
  }

  /** POST /api/admin/categories — 409 when the name or slug is taken. */
  @Post()
  create(@Body() dto: CreateCategoryDto): Promise<AdminCategory> {
    return this.categories.create(dto);
  }

  /** PATCH /api/admin/categories/:id — name, icon, color, description (not the slug). */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto): Promise<AdminCategory> {
    return this.categories.update(id, dto);
  }

  /** DELETE /api/admin/categories/:id — 204; 409 with the reason while it has questions or sessions. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.categories.remove(id);
  }
}
