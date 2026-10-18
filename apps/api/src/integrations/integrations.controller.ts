import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  Header,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/auth.decorator.js';
import type { AuthenticatedUser } from '../common/auth.types.js';
import { Roles } from '../common/roles.decorator.js';
import {
  CreateConnectionDto,
  CreateMappingDto,
  SyncConnectionDto,
  UpdateConnectionDto,
} from './integration.dto.js';
import { IntegrationsService } from './integrations.service.js';
import { OAuthCredentialService } from './oauth-credential.service.js';

@Controller('integrations')
export class IntegrationsController {
  constructor(
    @Inject(IntegrationsService)
    private readonly integrations: IntegrationsService,
    @Inject(OAuthCredentialService)
    private readonly oauth: OAuthCredentialService,
  ) {}
  @Get('options') options() {
    return this.integrations.options();
  }
  @Get() list() {
    return this.integrations.list();
  }
  @Get(':id/runs') runs(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.integrations.runs(id);
  }
  @Post(':id/oauth/start')
  @Roles('ADMIN')
  @Header('Cache-Control', 'no-store')
  startOAuth(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.oauth.start(id, user.id);
  }
  @Get('oauth/:family/callback')
  @Header('Cache-Control', 'no-store')
  async oauthCallback(
    @Param('family') family: string,
    @Query('state') state: string | undefined,
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Res() response: Response,
  ) {
    const result = await this.oauth.callback(family, state, code, error);
    response.redirect(303, await this.oauth.redirectDestination(result));
  }
  @Post() @Roles('ADMIN') create(
    @Body() dto: CreateConnectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.integrations.create(dto, user.id);
  }
  @Patch(':id') @Roles('ADMIN') update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateConnectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.integrations.update(id, dto, user.id);
  }
  @Post(':id/mappings') @Roles('ADMIN') map(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateMappingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.integrations.map(id, dto, user.id);
  }
  @Post(':id/sync') @Roles('ADMIN', 'MARKETING_OFFICER') sync(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SyncConnectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.integrations.sync(id, dto, user.id);
  }
  @Post(':id/disconnect') @Roles('ADMIN') disconnect(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.integrations.disconnect(id, user.id);
  }
}
