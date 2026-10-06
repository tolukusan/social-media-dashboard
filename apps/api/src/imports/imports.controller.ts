import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/auth.decorator.js';
import type { AuthenticatedUser } from '../common/auth.types.js';
import { Roles } from '../common/roles.decorator.js';
import { MapImportDto } from './dto/map-import.dto.js';
import { ImportsService } from './imports.service.js';

@Controller('imports')
export class ImportsController {
  constructor(
    @Inject(ImportsService) private readonly imports: ImportsService,
  ) {}

  @Post('preview')
  @Roles('ADMIN', 'MARKETING_OFFICER')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  preview(
    @UploadedFile()
    file: {
      originalname: string;
      mimetype?: string;
      size: number;
      buffer: Buffer;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file)
      throw new BadRequestException({
        code: 'IMPORT_FILE_REQUIRED',
        message: 'Select a file to import.',
      });
    return this.imports.preview(file, user.id);
  }

  @Post(':id/map')
  @Roles('ADMIN', 'MARKETING_OFFICER')
  map(@Param('id') id: string, @Body() dto: MapImportDto) {
    return this.imports.map(id, dto);
  }

  @Post(':id/confirm')
  @Roles('ADMIN', 'MARKETING_OFFICER')
  confirm(@Param('id') id: string) {
    return this.imports.confirm(id);
  }

  @Get()
  list() {
    return this.imports.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.imports.get(id);
  }

  @Get(':id/rows')
  rows(@Param('id') id: string) {
    return this.imports.rows(id);
  }
}
