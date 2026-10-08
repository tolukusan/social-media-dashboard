import { Module } from '@nestjs/common';
import { ReportingSettingsController } from './reporting-settings.controller.js';
import { ReportingSettingsService } from './reporting-settings.service.js';

@Module({
  controllers: [ReportingSettingsController],
  providers: [ReportingSettingsService],
})
export class SettingsModule {}
