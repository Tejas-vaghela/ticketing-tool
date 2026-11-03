import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * GET /api/reports/summary
   * Aggregated report summary metrics across issues.
   */
  @Get('summary')
  @HttpCode(HttpStatus.OK)
  async getSummary(@Query('projectId') projectId?: string) {
    return this.reportsService.getSummary(projectId);
  }

  /**
   * GET /api/reports/sla
   * Detailed SLA compliance and duration metrics.
   */
  @Get('sla')
  @HttpCode(HttpStatus.OK)
  async getSlaMetrics(@Query('projectId') projectId?: string) {
    return this.reportsService.getSlaMetrics(projectId);
  }
}

