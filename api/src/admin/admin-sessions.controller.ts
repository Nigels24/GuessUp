import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/roles.decorator.js';
import {
  AdminSessionsService,
  type AdminSessionDetail,
  type AdminSessionRow,
} from './admin-sessions.service.js';
import type { Page } from './dto/query.dto.js';
import { SessionDetailQueryDto, SessionListQueryDto } from './dto/session.dto.js';
import { sendCsv } from './reports.csv.js';
import { sessionCsvFilename, sessionDetailCsv, sessionsCsv, sessionsCsvFilename } from './sessions.csv.js';

/** Admin Panel > Game Sessions (monitoring, read only). */
@Roles('ADMIN')
@Controller('admin/sessions')
export class AdminSessionsController {
  constructor(private readonly sessions: AdminSessionsService) {}

  /**
   * GET /api/admin/sessions?studentId=&search=&categoryId=&difficulty=&status=&from=&to=&page=&pageSize=
   * With &format=csv: every matching session (no paging) as a download.
   */
  @Get()
  async list(
    @Query() query: SessionListQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Page<AdminSessionRow> | string> {
    if (query.format !== 'csv') return this.sessions.list(query);
    const now = new Date();
    const rows = await this.sessions.exportRows(query, now);
    return sendCsv(res, sessionsCsvFilename(query, now), sessionsCsv(rows));
  }

  /** GET /api/admin/sessions/:id — with ?format=csv, the session and its answers as a download. */
  @Get(':id')
  async get(
    @Param('id') id: string,
    @Query() query: SessionDetailQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminSessionDetail | string> {
    const session = await this.sessions.get(id);
    if (query.format !== 'csv') return session;
    return sendCsv(res, sessionCsvFilename(session), sessionDetailCsv(session));
  }
}
