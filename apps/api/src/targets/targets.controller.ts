import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../common/roles.decorator.js';
import { CurrentUser } from '../common/auth.decorator.js';
import type { AuthenticatedUser } from '../common/auth.types.js';
import { CreateTargetDto } from './dto/create-target.dto.js';
import { UpdateTargetDto } from './dto/update-target.dto.js';
import { TargetsService } from './targets.service.js';

@Controller('targets')
export class TargetsController {
  constructor(
    @Inject(TargetsService) private readonly targets: TargetsService,
  ) {}
  @Get() list() {
    return this.targets.list();
  }
  @Get('definitions') definitions() {
    return this.targets.definitions();
  }
  @Post() @Roles('ADMIN') create(
    @Body() dto: CreateTargetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.targets.create(dto, user.id);
  }
  @Patch(':id') @Roles('ADMIN') update(
    @Param('id') id: string,
    @Body() dto: UpdateTargetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.targets.update(id, dto, user.id);
  }
}
