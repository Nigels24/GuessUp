import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface CategoryDto {
  id: string;
  slug: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  activeQuestionCount: number;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** The subject categories in seed order, with how many active questions each has. */
  async list(): Promise<CategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { questions: { where: { isActive: true } } } } },
    });
    return categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      icon: c.icon,
      color: c.color,
      description: c.description,
      activeQuestionCount: c._count.questions,
    }));
  }
}
