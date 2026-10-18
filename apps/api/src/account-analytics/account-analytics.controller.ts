import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { AccountAnalyticsQueryDto } from './account-analytics.dto.js';
import { AccountAnalyticsService } from './account-analytics.service.js';

@Controller('integrations/:id/analytics')
export class AccountAnalyticsController {
  constructor(
    @Inject(AccountAnalyticsService)
    private readonly analytics: AccountAnalyticsService,
  ) {}

  @Get()
  list(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: AccountAnalyticsQueryDto,
  ) {
    return this.analytics.list(id, query);
  }
}
