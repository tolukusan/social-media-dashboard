import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
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

@Controller('integrations')
export class IntegrationsController {
  constructor(
    @Inject(IntegrationsService)
    private readonly integrations: IntegrationsService,
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
