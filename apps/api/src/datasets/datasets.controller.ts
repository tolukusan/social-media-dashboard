import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/auth.decorator.js';
import type { AuthenticatedUser } from '../common/auth.types.js';
import type { Response } from 'express';
import { Roles } from '../common/roles.decorator.js';
import {
  ApplyDatasetTemplateDto,
  CompareDatasetColumnsDto,
  CreateDatasetTemplateDto,
  DatasetPageQueryDto,
  DatasetImportPreviewDto,
  DatasetRowsQueryDto,
  ReplacementTargetDto,
  SelectDatasetSheetDto,
  UpdateDatasetColumnLabelsDto,
} from './dataset.dto.js';
import { DatasetsService } from './datasets.service.js';

@Controller('datasets')
export class DatasetsController {
  constructor(
    @Inject(DatasetsService) private readonly datasets: DatasetsService,
  ) {}

  @Post('imports/preview')
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
    @Body() dto: DatasetImportPreviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file)
      throw new BadRequestException({
        code: 'IMPORT_FILE_REQUIRED',
        message: 'Select a file to import.',
      });
    return this.datasets.preview(file, dto.campaignId, user.id, dto.datasetId);
  }

  @Post('imports/:attemptId/sheet')
  @Roles('ADMIN', 'MARKETING_OFFICER')
  selectSheet(
    @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
    @Body() dto: SelectDatasetSheetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.datasets.selectSheet(attemptId, dto.selectedSheet, user.id);
  }

  @Post('imports/:attemptId/replace')
  @Roles('ADMIN', 'MARKETING_OFFICER')
  replaceTarget(
    @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
    @Body() dto: ReplacementTargetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.datasets.setReplacementTarget(attemptId, dto, user.id);
  }

  @Post('imports/:attemptId/confirm')
  @Roles('ADMIN', 'MARKETING_OFFICER')
  confirm(
    @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.datasets.confirm(attemptId, user.id);
  }

  @Post('imports/:attemptId/template')
  @Roles('ADMIN', 'MARKETING_OFFICER')
  applyTemplate(
    @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
    @Body() dto: ApplyDatasetTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.datasets.applyTemplate(attemptId, dto, user.id);
  }

  @Post('compare/compatibility')
  compareColumns(
    @Body() dto: CompareDatasetColumnsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.datasets.compareColumns(dto, user.id);
  }

  @Post('compare/export.pdf')
  async exportComparisonPdf(
    @Body() dto: CompareDatasetColumnsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const result = await this.datasets.exportComparisonPdf(dto, user.id);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}.pdf"`,
    );
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Length', result.content.length);
    response.end(result.content);
  }

  @Get(':id/export.csv')
  async exportCsv(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: DatasetRowsQueryDto,
    @Res() response: Response,
  ) {
    const result = await this.datasets.exportCsv(id, query);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}.csv"`,
    );
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Length', result.content.length);
    response.end(result.content);
  }

  @Get(':id/export.pdf')
  async exportPdf(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: DatasetRowsQueryDto,
    @Res() response: Response,
  ) {
    const result = await this.datasets.exportPdf(id, query);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}.pdf"`,
    );
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Length', result.content.length);
    response.end(result.content);
  }

  @Get('templates')
  templates(@CurrentUser() user: AuthenticatedUser) {
    return this.datasets.listTemplates(user.id);
  }

  @Post('templates')
  @Roles('ADMIN', 'MARKETING_OFFICER')
  createTemplate(
    @Body() dto: CreateDatasetTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.datasets.createTemplate(dto, user.id);
  }

  @Get('campaigns/:campaignId')
  listCampaign(
    @Param('campaignId', new ParseUUIDPipe()) campaignId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.datasets.listCampaign(campaignId, user.id);
  }

  @Get('campaigns/:campaignId/history/:batchId')
  historicalDetails(
    @Param('campaignId', new ParseUUIDPipe()) campaignId: string,
    @Param('batchId', new ParseUUIDPipe()) batchId: string,
    @Query() query: DatasetPageQueryDto,
  ) {
    return this.datasets.historicalDetails(campaignId, batchId, query);
  }

  @Get(':id/rows')
  rows(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: DatasetRowsQueryDto,
  ) {
    return this.datasets.rows(id, query);
  }

  @Patch(':id/columns')
  @Roles('ADMIN', 'MARKETING_OFFICER')
  updateColumnLabels(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDatasetColumnLabelsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.datasets.updateColumnLabels(id, dto, user.id);
  }

  @Get(':id')
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.datasets.getDataset(id, user.id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  delete(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.datasets.delete(id, user.id);
  }
}
