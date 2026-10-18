import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/auth.decorator.js';
import type { AuthenticatedUser } from '../common/auth.types.js';
import { Roles } from '../common/roles.decorator.js';
import { AccountDateRangeDto, StartOAuthDto } from './account.dto.js';
import { ConnectedAccountsService } from './connected-accounts.service.js';

@Controller('accounts')
export class ConnectedAccountsController {
  constructor(
    @Inject(ConnectedAccountsService)
    private readonly accounts: ConnectedAccountsService,
  ) {}

  @Get('options')
  options() {
    return this.accounts.options();
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  list() {
    return this.accounts.list();
  }

  @Post('oauth/start')
  @Roles('ADMIN', 'MARKETING_OFFICER')
  startOAuth(
    @Body() dto: StartOAuthDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accounts.startOAuth(dto.provider, user.id);
  }

  // OAuth providers redirect here. A one-time state value binds this public
  // callback to the authenticated user who began the flow.
  @Get('oauth/callback')
  async callback(
    @Query('state') state: string,
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Res() response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.redirect(
      302,
      await this.accounts.finishOAuth(state ?? '', code, error),
    );
  }

  @Post(':id/sync')
  @Roles('ADMIN', 'MARKETING_OFFICER')
  sync(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AccountDateRangeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accounts.sync(id, dto.from, dto.to, user.id);
  }

  @Get(':id/analytics')
  analytics(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: AccountDateRangeDto,
  ) {
    return this.accounts.analytics(id, query.from, query.to);
  }

  @Get(':id/email-report')
  emailReport(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: AccountDateRangeDto,
  ) {
    return this.accounts.emailReport(id, query.from, query.to);
  }

  @Get(':id/report.pdf')
  @Header('Cache-Control', 'no-store')
  async reportPdf(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: AccountDateRangeDto,
    @Res() response: Response,
  ) {
    const pdf = await this.accounts.reportPdf(id, query.from, query.to);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="account-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
    );
    response.setHeader('Content-Length', pdf.length);
    response.end(pdf);
  }

  @Get(':id/email-report.pdf')
  @Header('Cache-Control', 'no-store')
  async emailReportPdf(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: AccountDateRangeDto,
    @Res() response: Response,
  ) {
    const pdf = await this.accounts.emailReportPdf(id, query.from, query.to);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="email-account-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
    );
    response.setHeader('Content-Length', pdf.length);
    response.end(pdf);
  }

  @Delete(':id')
  @Roles('ADMIN')
  disconnect(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accounts.disconnect(id, user.id);
  }

  @Delete(':id/data')
  @Roles('ADMIN')
  deleteData(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accounts.deleteData(id, user.id);
  }
}
