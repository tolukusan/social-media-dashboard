import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Delete,
} from '@nestjs/common';
import { CurrentUser } from '../common/auth.decorator.js';
import type { AuthenticatedUser } from '../common/auth.types.js';
import { Roles } from '../common/roles.decorator.js';
import { CreatePerformanceDto } from './dto/create-performance.dto.js';
import { PerformanceService } from './performance.service.js';
import { UpdatePerformanceDto } from './dto/update-performance.dto.js';

@Controller('performance-records')
export class PerformanceController {
  constructor(
    @Inject(PerformanceService)
    private readonly performance: PerformanceService,
  ) {}
  @Get() list() {
    return this.performance.list();
  }
  @Post() @Roles('ADMIN', 'MARKETING_OFFICER') create(
    @Body() dto: CreatePerformanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.create(dto, user.id);
  }
  @Patch(':id') @Roles('ADMIN', 'MARKETING_OFFICER') update(
    @Param('id') id: string,
    @Body() dto: UpdatePerformanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.update(id, dto, user.id);
  }
  @Delete(':id') @Roles('ADMIN') archive(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.archive(id, user.id);
  }
}
