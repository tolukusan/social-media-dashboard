import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module.js';
import { ConnectedAccountsController } from './connected-accounts.controller.js';
import { ConnectedAccountsService } from './connected-accounts.service.js';
import { AccountProviderClient } from './account-provider-client.js';
import { AccountAnalyticsModule } from '../account-analytics/account-analytics.module.js';

@Module({
  imports: [PrismaModule, AccountAnalyticsModule],
  controllers: [ConnectedAccountsController],
  providers: [ConnectedAccountsService, AccountProviderClient],
})
export class ConnectedAccountsModule {}
