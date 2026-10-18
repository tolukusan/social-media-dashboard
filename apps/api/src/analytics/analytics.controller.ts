import { Controller, Get, Inject, Query } from '@nestjs/common';
import { DashboardQueryDto } from './dto/dashboard-query.dto.js';
import { AnalyticsService } from './analytics.service.js';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
  ) {}

  @Get('default-period')
  defaultPeriod() {
    return this.analytics.defaultPeriod();
  }

  @Get('dashboard')
  dashboard(@Query() query: DashboardQueryDto) {
    return this.analytics.dashboard(query);
  }

  @Get('trends')
  trends(@Query() query: DashboardQueryDto) {
    return this.analytics.trends(query);
  }

  @Get('comparison')
  comparison(@Query() query: DashboardQueryDto) {
    return this.analytics.comparison(query);
  }

  @Get('dimension-comparison')
  dimensionComparison(@Query() query: DashboardQueryDto) {
    return this.analytics.dimensionComparison(query);
  }
}
