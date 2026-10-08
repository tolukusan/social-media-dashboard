import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

export const reportingCurrencies = Intl.supportedValuesOf('currency');
const settingsId = 'organisation';

@Injectable()
export class ReportingSettingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get() {
    const settings = await this.prisma.reportingSettings.findUnique({
      where: { id: settingsId },
    });
    return {
      reportingCurrency: settings?.reportingCurrency ?? null,
      availableCurrencies: reportingCurrencies,
    };
  }

  async update(reportingCurrency: string, actorUserId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('reporting-currency'))`;
      const previous = await tx.reportingSettings.findUnique({
        where: { id: settingsId },
      });
      await tx.reportingSettings.upsert({
        where: { id: settingsId },
        create: { id: settingsId, reportingCurrency },
        update: { reportingCurrency },
      });
      if (previous?.reportingCurrency !== reportingCurrency) {
        await tx.auditLog.create({
          data: {
            actorUserId,
            action: 'REPORTING_CURRENCY_CHANGED',
            entityType: 'ReportingSettings',
            entityId: settingsId,
            metadata: {
              previousCurrency: previous?.reportingCurrency ?? null,
              reportingCurrency,
            },
          },
        });
      }
    });
    return this.get();
  }
}
