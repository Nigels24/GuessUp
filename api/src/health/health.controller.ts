import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * GET /api/health
 * Also used to wake the Render free-tier server before a demo: the free plan
 * puts the service to sleep after about 15 minutes without traffic.
 * Public: no token needed.
 */
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: string; time: string; db: 'up' | 'down' }> {
    const db = (await this.prisma.isHealthy()) ? 'up' : 'down';
    return { status: 'ok', time: new Date().toISOString(), db };
  }
}
