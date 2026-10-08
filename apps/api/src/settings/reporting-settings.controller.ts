import { Body, Controller, Get, Inject, Patch } from '@nestjs/common';
import { IsIn, IsString } from 'class-validator';
import { Roles } from '../common/roles.decorator.js';
import { CurrentUser } from '../common/auth.decorator.js';
import type { AuthenticatedUser } from '../common/auth.types.js';
import {
  ReportingSettingsService,
  reportingCurrencies,
} from './reporting-settings.service.js';

class UpdateReportingSettingsDto {
  @IsString()
  @IsIn(reportingCurrencies)
  reportingCurrency!: string;
}

@Controller('settings/reporting')
export class ReportingSettingsController {
  constructor(
    @Inject(ReportingSettingsService)
    private readonly settings: ReportingSettingsService,
  ) {}

  @Get()
  get() {
    return this.settings.get();
  }

  @Patch()
  @Roles('ADMIN')
  update(
    @Body() dto: UpdateReportingSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settings.update(dto.reportingCurrency, user.id);
  }
}
