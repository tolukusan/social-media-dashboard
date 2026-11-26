import {
  Inject,
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

  constructor(
    @Inject(AccountAnalyticsService)
    private readonly analytics: AccountAnalyticsService,
  ) {}

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
    } catch (error) {
      const name = error instanceof Error ? error.name : 'UnknownError';
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code: unknown }).code)
          : 'none';
      this.logger.warn(
        `PROVIDER_DATA_RETENTION_SWEEP_FAILED error=${name} code=${code}`,
      );
    }
  }
}
