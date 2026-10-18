import { Module } from '@nestjs/common';
import { AccountAnalyticsController } from './account-analytics.controller.js';
import { AccountAnalyticsRetentionService } from './account-analytics-retention.service.js';
import { AccountAnalyticsService } from './account-analytics.service.js';

@Module({
  controllers: [AccountAnalyticsController],
  providers: [AccountAnalyticsService, AccountAnalyticsRetentionService],
  exports: [AccountAnalyticsService],
})
export class AccountAnalyticsModule {}
