import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/roles.decorator.js';
import { AdminDashboardService, type DashboardSummary } from './admin-dashboard.service.js';
import { AdminReportsService } from './admin-reports.service.js';
import { MostMissedQueryDto, ReportQueryDto } from './dto/report.dto.js';
import { activityCsv, csvFilename, mostMissedCsv, scoresCsv } from './reports.csv.js';
import type { ActivityReport, MostMissedReport, ScoresReport } from './reports.logic.js';

/** Sends `body` as a CSV download instead of JSON. */
function csv(res: Response, filename: string, body: string): string {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return body;
}

/**
 * Admin Panel > Reports and the Dashboard. Every report takes
 * ?from=YYYY-MM-DD&to=YYYY-MM-DD (default: the last 30 days), ?categoryId=,
 * and ?format=csv for a download.
 */
@Roles('ADMIN')
@Controller('admin')
export class AdminReportsController {
  constructor(
    private readonly reports: AdminReportsService,
    private readonly dashboard: AdminDashboardService,
  ) {}

  /** GET /api/admin/dashboard */
  @Get('dashboard')
  summary(): Promise<DashboardSummary> {
    return this.dashboard.summary();
  }

  /** GET /api/admin/reports/activity — active players, rounds per day and category, players. */
  @Get('reports/activity')
  async activity(
    @Query() query: ReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ActivityReport | string> {
    const report = await this.reports.activity(query);
    if (query.format !== 'csv') return report;
    return csv(res, csvFilename('player_activity', report), activityCsv(report));
  }

  /** GET /api/admin/reports/scores — average score and accuracy per category and difficulty. */
  @Get('reports/scores')
  async scores(
    @Query() query: ReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ScoresReport | string> {
    const report = await this.reports.scores(query);
    if (query.format !== 'csv') return report;
    return csv(res, csvFilename('average_scores', report), scoresCsv(report));
  }

  /** GET /api/admin/reports/most-missed?minAttempts=3&limit=20 — items most often answered wrongly. */
  @Get('reports/most-missed')
  async mostMissed(
    @Query() query: MostMissedQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MostMissedReport | string> {
    const report = await this.reports.mostMissed(query);
    if (query.format !== 'csv') return report;
    return csv(res, csvFilename('most_missed', report), mostMissedCsv(report));
  }
}
