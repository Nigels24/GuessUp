import { Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import {
  AdminSessionsService,
  type AdminSessionDetail,
  type AdminSessionRow,
} from './admin-sessions.service.js';
import type { Page } from './dto/query.dto.js';
import { SessionListQueryDto } from './dto/session.dto.js';

/** Admin Panel > Game Sessions (monitoring, read only). */
@Roles('ADMIN')
@Controller('admin/sessions')
export class AdminSessionsController {
  constructor(private readonly sessions: AdminSessionsService) {}

  /** GET /api/admin/sessions?studentId=&search=&categoryId=&difficulty=&status=&from=&to=&page=&pageSize= */
  @Get()
  list(@Query() query: SessionListQueryDto): Promise<Page<AdminSessionRow>> {
    return this.sessions.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<AdminSessionDetail> {
    return this.sessions.get(id);
  }
}
