import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './database/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ChannelsModule } from './channels/channels.module.js';
import { UsersModule } from './users/users.module.js';
import { CampaignsModule } from './campaigns/campaigns.module.js';
import { PerformanceModule } from './performance/performance.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { TargetsModule } from './targets/targets.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { ImportsModule } from './imports/imports.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { IntegrationsModule } from './integrations/integrations.module.js';
import { AccountAnalyticsModule } from './account-analytics/account-analytics.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ChannelsModule,
    UsersModule,
    CampaignsModule,
    PerformanceModule,
    AnalyticsModule,
    TargetsModule,
    ReportsModule,
    ImportsModule,
    SettingsModule,
    IntegrationsModule,
    AccountAnalyticsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
