import { Controller, Get } from '@nestjs/common';
import { CategoriesService, type CategoryDto } from './categories.service.js';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  /** GET /api/categories — any signed-in user (the student home screen). */
  @Get()
  list(): Promise<CategoryDto[]> {
    return this.categories.list();
  }
}
