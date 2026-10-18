import { Body, Delete, Header } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { DeletionService, type ArchiveKind } from './deletion.service.js';
class DeleteArchiveDto {
  @IsString() @Length(40, 100) confirmationReference!: string;
  @IsString() @Length(1, 500) typedText!: string;
}
import {
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  Inject,
} from '@nestjs/common';
import { Roles } from '../common/roles.decorator.js';
import { CurrentUser } from '../common/auth.decorator.js';
import type { AuthenticatedUser } from '../common/auth.types.js';
import { ArchiveService } from './archive.service.js';
@Controller('archive')
@Roles('ADMIN')
export class ArchiveController {
  constructor(
    @Inject(ArchiveService) private readonly archive: ArchiveService,
    @Inject(DeletionService) private readonly deletion: DeletionService,
  ) {}
  @Get('campaigns') campaigns() {
    return this.archive.campaigns();
  }
  @Get('records') records() {
    return this.archive.records();
  }
  @Post('campaigns/:id/restore') restoreCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.archive.restore('campaigns', id, user.id);
  }
  @Post('records/:id/restore') restoreRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.archive.restore('records', id, user.id);
  }
  @Post(':kind/:id/deletion-preview')
  @Header('Cache-Control', 'no-store')
  preview(
    @Param('kind') kind: ArchiveKind,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.deletion.preview(kind, id, user.id);
  }
  @Delete(':kind/:id/permanent')
  remove(
    @Param('kind') kind: ArchiveKind,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeleteArchiveDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.deletion.remove(
      kind,
      id,
      user.id,
      dto.confirmationReference,
      dto.typedText,
    );
  }
}
