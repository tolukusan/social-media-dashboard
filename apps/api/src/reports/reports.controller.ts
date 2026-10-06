import { Controller, Get, Inject, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DashboardQueryDto } from '../analytics/dto/dashboard-query.dto.js';
import { ReportsService } from './reports.service.js';

@Controller('reports')
export class ReportsController {
  constructor(
    @Inject(ReportsService) private readonly reports: ReportsService,
  ) {}

  @Get('preview')
  preview(@Query() query: DashboardQueryDto) {
    return this.reports.preview(query);
  }

  @Get('dashboard.pdf')
  async dashboardPdf(
    @Query() query: DashboardQueryDto,
    @Res() response: Response,
  ) {
    const pdf = await this.reports.dashboardPdf(query);
    const date = new Date().toISOString().slice(0, 10);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="marketing-report-${date}.pdf"`,
    );
    response.setHeader('Content-Length', pdf.length);
    response.end(pdf);
  }
}
