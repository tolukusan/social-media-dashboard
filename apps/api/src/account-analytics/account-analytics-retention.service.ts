import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AccountAnalyticsService } from './account-analytics.service.js';

@Injectable()
export class AccountAnalyticsRetentionService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AccountAnalyticsRetentionService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly analytics: AccountAnalyticsService) {}

  onModuleInit() {
    if (process.env.TEST_DATABASE_URL) return;
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async sweep() {
    try {
      await this.analytics.purgeExpired();
    } catch {
      this.logger.warn('PROVIDER_DATA_RETENTION_SWEEP_FAILED');
    }
  }
}
