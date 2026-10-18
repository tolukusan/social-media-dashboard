import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import PDFDocument from 'pdfkit';
import { Prisma } from '../generated/prisma/client.js';
import { lockLifecycle, requireWritableCampaign } from '../common/lifecycle.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  DatasetFileParser,
  type DatasetColumn,
  type DatasetSheet,
} from './dataset-file-parser.js';
import type {
  ApplyDatasetTemplateDto,
  CompareDatasetColumnsDto,
  CreateDatasetTemplateDto,
  DatasetColumnLabelDto,
  DatasetPageQueryDto,
  DatasetRowsQueryDto,
  ReplacementTargetDto,
  UpdateDatasetColumnLabelsDto,
} from './dataset.dto.js';

type DatasetFile = {
  originalname: string;
  mimetype?: string;
  size: number;
  buffer: Buffer;
};
type SheetMetadata = Pick<
  DatasetSheet,
  'key' | 'name' | 'columns' | 'headerFingerprint'
> & {
  rowCount: number;
};

function jsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function filenameLabel(filename: string) {
  return (
    basename(filename.replaceAll('\\', '/'))
      .replace(/\.[^.]+$/, '')
      .slice(0, 240) || 'Imported dataset'
  );
}

function publicDatasetName(dataset: { name: string; sourceFilename: string }) {
  return dataset.name || filenameLabel(dataset.sourceFilename);
}

function meaningful(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(meaningful);
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  const cell = value as Record<string, unknown>;
  if (cell.$cell === 'number')
    return String(cell.raw ?? cell.displayText ?? '');
  if (cell.$cell === 'date') return String(cell.displayText ?? cell.iso ?? '');
  if (cell.$cell === 'richText' || cell.$cell === 'hyperlink')
    return String(cell.text ?? '');
  if (cell.$cell === 'formula') {
    const cached = cellText(cell.cachedValue);
    return cached ? `${cached} (formula)` : String(cell.formula ?? 'Formula');
  }
  if (cell.$cell === 'error')
    return `Spreadsheet error: ${String(cell.value ?? '')}`;
  return JSON.stringify(value);
}

function csvField(value: unknown) {
  const text = cellText(value);
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/u.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

function downloadName(value: string) {
  return (
    value
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      .replace(/^[.-]+|[.-]+$/g, '')
      .slice(0, 120) || 'dataset'
  );
}

@Injectable()
export class DatasetsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DatasetFileParser) private readonly parser: DatasetFileParser,
  ) {}

  async listCampaign(campaignId: string, actorId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, archivedAt: null },
      select: { id: true, name: true },
    });
    if (!campaign) throw this.notFound();
    const [datasets, actor] = await Promise.all([
      this.prisma.dataset.findMany({
        where: { campaignId },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      this.currentActor(actorId),
    ]);
    const revisions = await this.prisma.datasetRevision.findMany({
      where: {
        OR: datasets.map((dataset) => ({
          datasetId: dataset.id,
          revisionNumber: dataset.currentRevision,
        })),
      },
      select: { datasetId: true, rowCount: true },
    });
    const rowCountByDataset = new Map(
      revisions.map((revision) => [revision.datasetId, revision.rowCount]),
    );
    return {
      campaign,
      datasets: datasets.map((dataset) => ({
        ...this.datasetCard(dataset, actor.role.code),
        rowCount: rowCountByDataset.get(dataset.id) ?? 0,
      })),
      historicalImports: await this.historicalImports(campaignId),
    };
  }

  async getDataset(datasetId: string, actorId: string) {
    const dataset = await this.prisma.dataset.findFirst({
      where: { id: datasetId, campaign: { archivedAt: null } },
      include: { campaign: { select: { id: true, name: true } } },
    });
    if (!dataset) throw this.notFound();
    const [revision, actor] = await Promise.all([
      this.prisma.datasetRevision.findUnique({
        where: {
          datasetId_revisionNumber: {
            datasetId,
            revisionNumber: dataset.currentRevision,
          },
        },
      }),
      this.currentActor(actorId),
    ]);
    if (!revision) throw this.notFound();
    return {
      ...this.datasetCard(dataset, actor.role.code),
      campaign: dataset.campaign,
      currentRevision: dataset.currentRevision,
      columns: revision.columns,
      headerFingerprint: revision.headerFingerprint,
      rowCount: revision.rowCount,
      worksheetName: revision.worksheetName,
      sourceFilename: revision.sourceFilename,
      importedAt: revision.createdAt,
    };
  }

  async rows(datasetId: string, query: DatasetRowsQueryDto) {
    const dataset = await this.prisma.dataset.findFirst({
      where: { id: datasetId, campaign: { archivedAt: null } },
    });
    if (!dataset) throw this.notFound();
    if (
      query.expectedRevision !== undefined &&
      Number(query.expectedRevision) !== dataset.currentRevision
    )
      throw this.staleDataset();
    const revision = await this.prisma.datasetRevision.findUnique({
      where: {
        datasetId_revisionNumber: {
          datasetId,
          revisionNumber: dataset.currentRevision,
        },
      },
    });
    if (!revision) throw this.notFound();
    const columns = revision.columns as unknown as DatasetColumn[];
    const dateColumnOrdinal = query.dateColumnId
      ? this.resolveDateColumn(columns, query.dateColumnId)
      : null;
    if ((query.from || query.to) && dateColumnOrdinal === null)
      throw new BadRequestException({
        code: 'DATASET_DATE_COLUMN_REQUIRED',
        message: 'Choose a date column before filtering by date.',
      });
    if (query.from && query.to && query.from > query.to)
      throw new BadRequestException({
        code: 'DATASET_INVALID_DATE_RANGE',
        message: 'The start date must be before the end date.',
      });

    const search = query.search?.trim() || null;
    const page = Number(query.page);
    const pageSize = Number(query.pageSize);
    const offset = (page - 1) * pageSize;
    const dateFilter =
      dateColumnOrdinal === null
        ? Prisma.empty
        : Prisma.sql`AND (${query.from ?? null}::date IS NULL OR (r."typedCells" -> (${dateColumnOrdinal}::int) ->> 'value')::date >= ${query.from ?? null}::date)
            AND (${query.to ?? null}::date IS NULL OR (r."typedCells" -> (${dateColumnOrdinal}::int) ->> 'value')::date <= ${query.to ?? null}::date)`;
    const searchFilter = search
      ? Prisma.sql`AND r."cells"::text ILIKE ${`%${search}%`}`
      : Prisma.empty;
    const where = Prisma.sql`r."revisionId" = ${revision.id}::uuid ${searchFilter} ${dateFilter}`;
    const [countResult, resultRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT count(*) AS count
        FROM "social_media_dashboard"."DatasetRow" r
        WHERE ${where}
      `),
      this.prisma.$queryRaw<
        Array<{
          id: string;
          sourceRowNumber: number;
          cells: unknown;
          typedCells: unknown;
        }>
      >(Prisma.sql`
        SELECT r."id", r."sourceRowNumber", r."cells", r."typedCells"
        FROM "social_media_dashboard"."DatasetRow" r
        WHERE ${where}
        ORDER BY r."sourceRowNumber" ASC, r."id" ASC
        LIMIT ${pageSize} OFFSET ${offset}
      `),
    ]);
    const totalRows = Number(countResult[0]?.count ?? 0n);
    return {
      datasetId,
      revision: dataset.currentRevision,
      page,
      pageSize,
      totalRows,
      totalPages: Math.ceil(totalRows / pageSize),
      rows: resultRows,
    };
  }

  async exportCsv(datasetId: string, query: DatasetRowsQueryDto) {
    const scope = await this.exportScope(
      datasetId,
      query,
      query.expectedRevision,
    );
    const headers = scope.columns.map((column) =>
      csvField(column.originalName),
    );
    const lines = [headers.join(',')];
    for (const row of scope.rows)
      lines.push(
        scope.columns
          .map((column) => csvField(row.cells[column.ordinal]))
          .join(','),
      );
    return {
      filename: downloadName(scope.dataset.name),
      content: Buffer.from(`\uFEFF${lines.join('\r\n')}\r\n`, 'utf8'),
    };
  }

  async exportPdf(datasetId: string, query: DatasetRowsQueryDto) {
    const scope = await this.exportScope(
      datasetId,
      query,
      query.expectedRevision,
    );
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 36, right: 40, bottom: 36, left: 40 },
      info: {
        Title: `${scope.dataset.name} dataset`,
        Creator: 'Marketwise',
      },
    });
    const chunks: Buffer[] = [];
    const contentPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
    doc.fillColor('#172033').fontSize(18).text(scope.dataset.name);
    doc
      .moveDown(0.25)
      .fillColor('#475467')
      .fontSize(9)
      .text(`Campaign: ${scope.dataset.campaign.name}`)
      .text(`Source: ${scope.revision.sourceFilename}`)
      .text(`Worksheet: ${scope.revision.worksheetName}`)
      .text(`Imported: ${scope.revision.createdAt.toISOString()}`)
      .text(`Revision: ${scope.revision.revisionNumber}`)
      .text(`Rows in scope: ${scope.rows.length}`)
      .text(
        query.chartColumnId
          ? `Selected chart column: ${scope.columns.find((column) => column.id === query.chartColumnId)?.label ?? 'unavailable'}. Each plotted/exported observation remains a source row.`
          : 'No chart column selected.',
      )
      .text(
        `Date filter: ${query.from ?? 'all'} to ${query.to ?? 'all'}${query.dateColumnId ? ` · ${scope.columns.find((column) => column.id === query.dateColumnId)?.label ?? ''}` : ''}`,
      );
    doc.moveDown().fillColor('#172033').fontSize(12).text('Imported rows');
    for (const row of scope.rows) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 35) doc.addPage();
      doc
        .moveDown(0.25)
        .fillColor('#344054')
        .fontSize(8)
        .text(`Source row ${row.sourceRowNumber}`, { continued: false });
      for (const column of scope.columns) {
        doc
          .fontSize(7)
          .fillColor('#667085')
          .text(`${column.label} [${column.originalName || 'blank header'}]:`, {
            continued: true,
          })
          .fillColor('#172033')
          .text(cellText(row.cells[column.ordinal]) || '(blank)', {
            continued: false,
          });
      }
    }
    doc.end();
    return {
      filename: downloadName(scope.dataset.name),
      content: await contentPromise,
    };
  }

  async exportComparisonPdf(dto: CompareDatasetColumnsDto, actorId: string) {
    const comparison = await this.compareColumns(dto, actorId);
    const [left, right] = await Promise.all([
      this.exportScope(
        dto.leftDatasetId,
        { page: 1, pageSize: 50 },
        comparison.left.revision,
      ),
      this.exportScope(
        dto.rightDatasetId,
        { page: 1, pageSize: 50 },
        comparison.right.revision,
      ),
    ]);
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 36, right: 40, bottom: 36, left: 40 },
      info: { Title: 'Dataset column comparison', Creator: 'Marketwise' },
    });
    const chunks: Buffer[] = [];
    const contentPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
    doc.fillColor('#172033').fontSize(18).text('Dataset column comparison');
    doc
      .moveDown(0.3)
      .fillColor('#475467')
      .fontSize(9)
      .text(`Campaign: ${left.dataset.campaign.name}`)
      .text(`Generated: ${new Date().toISOString()}`)
      .text(
        comparison.chart.eligible
          ? `Shared time-series chart eligible · observation interval ${comparison.chart.intervalMilliseconds} ms`
          : `Side-by-side comparison · ${comparison.chart.reason}`,
      )
      .text(
        'Source values are listed independently; no rows or values are combined.',
      );

    const addSide = (
      title: string,
      scope: typeof left,
      columnId: string,
      dateColumnId?: string,
    ) => {
      const column = scope.columns.find((item) => item.id === columnId);
      const dateColumn = dateColumnId
        ? scope.columns.find((item) => item.id === dateColumnId)
        : null;
      if (!column) throw this.notFound();
      doc.moveDown().fillColor('#172033').fontSize(12).text(title);
      doc
        .fontSize(8)
        .fillColor('#475467')
        .text(`Dataset: ${scope.dataset.name}`)
        .text(`Source: ${scope.revision.sourceFilename}`)
        .text(
          `Column: ${column.label} [${column.originalName || 'blank header'}]`,
        )
        .text(
          `Meaning: ${column.meaning ?? 'unspecified'} · Unit: ${column.unit ?? 'unspecified'}`,
        )
        .text(`Rows: ${scope.rows.length}`);
      for (const row of scope.rows) {
        if (doc.y > doc.page.height - doc.page.margins.bottom - 24)
          doc.addPage();
        const date = dateColumn ? cellText(row.cells[dateColumn.ordinal]) : '';
        doc
          .fontSize(7)
          .fillColor('#667085')
          .text(
            `Source row ${row.sourceRowNumber}${date ? ` · ${date}` : ''}: `,
            {
              continued: true,
            },
          )
          .fillColor('#172033')
          .text(cellText(row.cells[column.ordinal]) || '(blank)');
      }
    };
    addSide('First column', left, dto.leftColumnId, dto.leftDateColumnId);
    addSide('Second column', right, dto.rightColumnId, dto.rightDateColumnId);
    doc.end();
    return { filename: 'dataset-comparison', content: await contentPromise };
  }

  private async exportScope(
    datasetId: string,
    query: DatasetRowsQueryDto,
    expectedRevision?: number,
  ) {
    const dataset = await this.prisma.dataset.findFirst({
      where: { id: datasetId, campaign: { archivedAt: null } },
      include: { campaign: { select: { id: true, name: true } } },
    });
    if (!dataset) throw this.notFound();
    if (
      expectedRevision !== undefined &&
      dataset.currentRevision !== Number(expectedRevision)
    )
      throw this.staleDataset();
    const revision = await this.prisma.datasetRevision.findUnique({
      where: {
        datasetId_revisionNumber: {
          datasetId,
          revisionNumber: dataset.currentRevision,
        },
      },
    });
    if (!revision) throw this.notFound();
    const columns = revision.columns as unknown as DatasetColumn[];
    if (
      query.chartColumnId &&
      !columns.some(
        (column) =>
          column.id === query.chartColumnId && column.type === 'number',
      )
    )
      throw new BadRequestException({
        code: 'DATASET_CHART_COLUMN_INVALID',
        message: 'Choose an available numeric column for the chart.',
      });
    const dateColumnOrdinal = query.dateColumnId
      ? this.resolveDateColumn(columns, query.dateColumnId)
      : null;
    if ((query.from || query.to) && dateColumnOrdinal === null)
      throw new BadRequestException({
        code: 'DATASET_DATE_COLUMN_REQUIRED',
        message: 'Choose a date column before filtering by date.',
      });
    if (query.from && query.to && query.from > query.to)
      throw new BadRequestException({
        code: 'DATASET_INVALID_DATE_RANGE',
        message: 'The start date must be before the end date.',
      });
    const dateFilter =
      dateColumnOrdinal === null
        ? Prisma.empty
        : Prisma.sql`AND (${query.from ?? null}::date IS NULL OR (r."typedCells" -> (${dateColumnOrdinal}::int) ->> 'value')::date >= ${query.from ?? null}::date)
            AND (${query.to ?? null}::date IS NULL OR (r."typedCells" -> (${dateColumnOrdinal}::int) ->> 'value')::date <= ${query.to ?? null}::date)`;
    const search = query.search?.trim() || null;
    const searchFilter = search
      ? Prisma.sql`AND r."cells"::text ILIKE ${`%${search}%`}`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      Array<{ sourceRowNumber: number; cells: unknown[] }>
    >(Prisma.sql`
      SELECT r."sourceRowNumber", r."cells"
      FROM "social_media_dashboard"."DatasetRow" r
      WHERE r."revisionId" = ${revision.id}::uuid ${searchFilter} ${dateFilter}
      ORDER BY r."sourceRowNumber" ASC, r."id" ASC
    `);
    return { dataset, revision, columns, rows };
  }

  async compareColumns(dto: CompareDatasetColumnsDto, actorId: string) {
    await this.currentActor(actorId);
    const [leftDataset, rightDataset] = await Promise.all([
      this.prisma.dataset.findFirst({
        where: { id: dto.leftDatasetId, campaign: { archivedAt: null } },
      }),
      this.prisma.dataset.findFirst({
        where: { id: dto.rightDatasetId, campaign: { archivedAt: null } },
      }),
    ]);
    if (!leftDataset || !rightDataset) throw this.notFound();
    if (
      (dto.leftExpectedRevision !== undefined &&
        dto.leftExpectedRevision !== leftDataset.currentRevision) ||
      (dto.rightExpectedRevision !== undefined &&
        dto.rightExpectedRevision !== rightDataset.currentRevision)
    )
      throw this.staleDataset();
    if (leftDataset.campaignId !== rightDataset.campaignId)
      throw new BadRequestException({
        code: 'DATASET_COMPARE_CAMPAIGN_MISMATCH',
        message: 'Choose datasets from the same campaign to compare them.',
      });
    if (
      leftDataset.id === rightDataset.id &&
      dto.leftColumnId === dto.rightColumnId
    )
      throw new BadRequestException({
        code: 'DATASET_COMPARE_SAME_COLUMN',
        message: 'Choose two different columns to compare.',
      });

    const [leftRevision, rightRevision] = await Promise.all([
      this.prisma.datasetRevision.findUnique({
        where: {
          datasetId_revisionNumber: {
            datasetId: leftDataset.id,
            revisionNumber: leftDataset.currentRevision,
          },
        },
      }),
      this.prisma.datasetRevision.findUnique({
        where: {
          datasetId_revisionNumber: {
            datasetId: rightDataset.id,
            revisionNumber: rightDataset.currentRevision,
          },
        },
      }),
    ]);
    if (!leftRevision || !rightRevision) throw this.notFound();
    const leftColumns = leftRevision.columns as unknown as DatasetColumn[];
    const rightColumns = rightRevision.columns as unknown as DatasetColumn[];
    const leftColumn = leftColumns.find(
      (column) => column.id === dto.leftColumnId,
    );
    const rightColumn = rightColumns.find(
      (column) => column.id === dto.rightColumnId,
    );
    if (leftColumn?.type !== 'number' || rightColumn?.type !== 'number')
      throw new BadRequestException({
        code: 'DATASET_COMPARE_NUMERIC_COLUMNS_REQUIRED',
        message: 'Choose numeric columns to compare.',
      });

    const result = {
      campaignId: leftDataset.campaignId,
      left: {
        datasetId: leftDataset.id,
        revision: leftDataset.currentRevision,
        datasetName: publicDatasetName(leftDataset),
        sourceFilename: leftRevision.sourceFilename,
        columnId: leftColumn.id,
        columnLabel: leftColumn.label,
        originalName: leftColumn.originalName,
        meaning: leftColumn.meaning ?? null,
        unit: leftColumn.unit ?? null,
        dateColumnId: dto.leftDateColumnId ?? null,
      },
      right: {
        datasetId: rightDataset.id,
        revision: rightDataset.currentRevision,
        datasetName: publicDatasetName(rightDataset),
        sourceFilename: rightRevision.sourceFilename,
        columnId: rightColumn.id,
        columnLabel: rightColumn.label,
        originalName: rightColumn.originalName,
        meaning: rightColumn.meaning ?? null,
        unit: rightColumn.unit ?? null,
        dateColumnId: dto.rightDateColumnId ?? null,
      },
      chart: {
        eligible: false,
        reason: 'Choose a date column for each dataset.',
        intervalMilliseconds: null as number | null,
      },
    };

    if (!dto.leftDateColumnId || !dto.rightDateColumnId) return result;
    const leftDateOrdinal = this.resolveDateColumn(
      leftColumns,
      dto.leftDateColumnId,
    );
    const rightDateOrdinal = this.resolveDateColumn(
      rightColumns,
      dto.rightDateColumnId,
    );
    const normalize = (value: string | null | undefined) =>
      value?.trim().toLocaleLowerCase('en-US') ?? '';
    const leftMeaning = normalize(leftColumn.meaning);
    const rightMeaning = normalize(rightColumn.meaning);
    const leftUnit = normalize(leftColumn.unit);
    const rightUnit = normalize(rightColumn.unit);
    if (!leftMeaning || !rightMeaning || !leftUnit || !rightUnit)
      return {
        ...result,
        chart: {
          ...result.chart,
          reason:
            'Add a matching column meaning and unit to both columns to use a shared chart.',
        },
      };
    if (leftMeaning !== rightMeaning || leftUnit !== rightUnit)
      return {
        ...result,
        chart: {
          ...result.chart,
          reason:
            'The selected columns have different meanings or units, so they are shown side by side.',
        },
      };

    const [leftInterval, rightInterval] = await Promise.all([
      this.observationInterval(leftRevision.id, leftDateOrdinal),
      this.observationInterval(rightRevision.id, rightDateOrdinal),
    ]);
    if (!leftInterval || !rightInterval)
      return {
        ...result,
        chart: {
          ...result.chart,
          reason:
            'A shared chart needs at least two dated observations in each dataset.',
        },
      };
    if (leftInterval !== rightInterval)
      return {
        ...result,
        chart: {
          ...result.chart,
          reason:
            'The datasets use different observation intervals, so they are shown side by side.',
        },
      };
    return {
      ...result,
      chart: {
        eligible: true,
        reason: null,
        intervalMilliseconds: leftInterval,
      },
    };
  }

  private async observationInterval(revisionId: string, ordinal: number) {
    const values = await this.prisma.$queryRaw<Array<{ value: string }>>(
      Prisma.sql`
        SELECT DISTINCT r."typedCells" -> ${ordinal}::int ->> 'value' AS value
        FROM "social_media_dashboard"."DatasetRow" r
        WHERE r."revisionId" = ${revisionId}::uuid
          AND r."typedCells" -> ${ordinal}::int ->> 'kind' = 'date'
          AND r."typedCells" -> ${ordinal}::int ->> 'value' IS NOT NULL
        ORDER BY value ASC
      `,
    );
    const timestamps = values
      .map(({ value }) => Date.parse(value))
      .filter(Number.isFinite);
    if (timestamps.length < 2) return null;
    const intervals = new Set<number>();
    for (let index = 1; index < timestamps.length; index += 1) {
      const difference = timestamps[index]! - timestamps[index - 1]!;
      if (difference > 0) intervals.add(difference);
      if (intervals.size > 1) return null;
    }
    return intervals.values().next().value ?? null;
  }

  async historicalDetails(
    campaignId: string,
    batchId: string,
    query: DatasetPageQueryDto,
  ) {
    const page = Number(query.page);
    const pageSize = Number(query.pageSize);
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, archivedAt: null },
      select: { id: true },
    });
    if (!campaign) throw this.notFound('CAMPAIGN_NOT_FOUND');
    const batch = await this.prisma.importBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        originalFilename: true,
        displayName: true,
        selectedSheet: true,
        createdAt: true,
      },
    });
    if (!batch) throw this.notFound('HISTORICAL_IMPORT_NOT_FOUND');
    const where = {
      importBatchId: batchId,
      campaignPlatform: { campaignChannel: { campaignId } },
    };
    const [totalRecords, rows] = await Promise.all([
      this.prisma.performanceRecord.count({ where }),
      this.prisma.performanceRecord.findMany({
        where,
        include: {
          metricValues: {
            include: {
              metricDefinition: {
                select: { code: true, name: true, unit: true },
              },
            },
            orderBy: { id: 'asc' },
          },
          campaignPlatform: {
            include: {
              platform: { select: { name: true } },
              campaignChannel: {
                include: { channel: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: [{ recordDate: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    if (!totalRecords) throw this.notFound('HISTORICAL_IMPORT_NOT_FOUND');
    return {
      id: batch.id,
      campaignId,
      name: batch.displayName || filenameLabel(batch.originalFilename),
      sourceFilename: batch.originalFilename,
      worksheetName: batch.selectedSheet,
      importedAt: batch.createdAt,
      originalFileAvailable: false,
      note: 'These are the campaign records still linked to an earlier import. Later edits or additional values may be present; the original file contents are unavailable.',
      page,
      pageSize,
      totalRecords,
      totalPages: Math.ceil(totalRecords / pageSize),
      rows: rows.map((record) => ({
        id: record.id,
        date: record.recordDate.toISOString().slice(0, 10),
        status: record.status,
        channel: record.campaignPlatform.campaignChannel.channel.name,
        platform: record.campaignPlatform.platform.name,
        values: record.metricValues.map((value) => ({
          code: value.metricDefinition.code,
          name: value.metricDefinition.name,
          unit: value.metricDefinition.unit,
          value: value.value.toString(),
        })),
      })),
    };
  }

  async updateColumnLabels(
    datasetId: string,
    dto: UpdateDatasetColumnLabelsDto,
    actorId: string,
  ) {
    await this.assertCanReplace(actorId);
    return this.prisma.$transaction(async (tx) => {
      await lockLifecycle(tx);
      const dataset = await tx.dataset.findFirst({
        where: {
          id: datasetId,
          managementCapability: 'MANAGEABLE',
          campaign: { archivedAt: null },
        },
      });
      if (!dataset) throw this.notFound();
      await requireWritableCampaign(tx, dataset.campaignId);
      await this.assertCanReplace(actorId, tx);
      const revision = await tx.datasetRevision.findUnique({
        where: {
          datasetId_revisionNumber: {
            datasetId,
            revisionNumber: dataset.currentRevision,
          },
        },
      });
      if (!revision) throw this.notFound();
      const existing = revision.columns as unknown as DatasetColumn[];
      const normalized = this.normalizedLabelEntries(dto.columns);
      const validIds = new Set(existing.map((column) => column.id));
      if (normalized.some((entry) => !validIds.has(entry.id)))
        throw this.templateInvalid();
      const byId = new Map(normalized.map((entry) => [entry.id, entry]));
      const columns = existing.map((column) => ({
        ...column,
        label: byId.get(column.id)?.label ?? column.label,
        meaning: byId.get(column.id)?.meaning ?? column.meaning ?? null,
        unit: byId.get(column.id)?.unit ?? column.unit ?? null,
      }));
      await tx.datasetRevision.update({
        where: { id: revision.id },
        data: { columns: jsonInput(columns) },
      });
      await this.audit(tx, actorId, 'DATASET_COLUMNS_LABEL', datasetId, {
        changedColumnIds: [...byId.keys()],
        revision: dataset.currentRevision,
      });
      return this.datasetResult(tx, datasetId, actorId);
    });
  }

  async applyTemplate(
    attemptId: string,
    dto: ApplyDatasetTemplateDto,
    actorId: string,
  ) {
    await this.assertCanImport(actorId);
    const batch = await this.getAttempt(attemptId, actorId);
    if (!batch.selectedSheet)
      throw new ConflictException({
        code: 'DATASET_SHEET_REQUIRED',
        message: 'Choose a worksheet before using an import template.',
      });
    const template = await this.prisma.datasetImportTemplate.findUnique({
      where: { id: dto.templateId },
    });
    if (!template)
      throw new NotFoundException({
        code: 'DATASET_TEMPLATE_NOT_FOUND',
        message: 'Import template not found.',
      });
    const currentSheet = this.attemptSheet(batch.mapping, batch.selectedSheet);
    if (template.headerFingerprint !== currentSheet.headerFingerprint)
      throw new ConflictException({
        code: 'DATASET_TEMPLATE_HEADERS_MISMATCH',
        message: 'This template was saved for different column headers.',
      });
    const labels = this.normalizedLabels(
      (template.rules as { columns?: DatasetColumnLabelDto[] }).columns ?? [],
      currentSheet.columns,
    );
    const mapping = batch.mapping as {
      [key: string]: unknown;
      sheets?: SheetMetadata[];
    };
    const updatedSheets = this.attemptSheets(mapping).map((sheet) =>
      sheet.key === batch.selectedSheet
        ? {
            ...sheet,
            columns: sheet.columns.map((column) => ({
              ...column,
              label: labels.get(column.id) ?? column.label,
            })),
          }
        : sheet,
    );
    await this.prisma.importBatch.update({
      where: { id: batch.id },
      data: { mapping: jsonInput({ ...mapping, sheets: updatedSheets }) },
    });
    return this.attemptPreview(attemptId, actorId);
  }

  async preview(
    file: DatasetFile,
    campaignId: string,
    actorId: string,
    datasetId?: string,
  ) {
    const attemptStartedAt = new Date();
    await this.assertCanImport(actorId);
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, archivedAt: null },
      select: { id: true },
    });
    if (!campaign) throw this.notFound('CAMPAIGN_NOT_FOUND');

    let target: {
      id: string;
      campaignId: string;
      version: number;
      managementCapability: string;
    } | null = null;
    if (datasetId) {
      target = await this.prisma.dataset.findUnique({
        where: { id: datasetId },
        select: {
          id: true,
          campaignId: true,
          version: true,
          managementCapability: true,
        },
      });
      if (!target || target.campaignId !== campaignId) throw this.notFound();
      if (target.managementCapability !== 'MANAGEABLE')
        throw this.protectedDataset();
    }
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    const operation = target ? 'REPLACE' : 'CREATE';
    const batch = await this.prisma.importBatch.create({
      data: {
        sourceType: 'FILE_DATASET',
        displayName: filenameLabel(file.originalname),
        originalFilename: file.originalname.slice(0, 500),
        mimeType: file.mimetype?.slice(0, 120) ?? null,
        checksum,
        importedByUserId: actorId,
        status: 'PREVIEW',
        mapping: jsonInput({ dataset: true, sheets: [] }),
        datasetCampaignId: campaignId,
        datasetOperation: operation,
        targetDatasetId: target?.id ?? null,
        expectedDatasetVersion: target?.version ?? null,
        datasetAttemptStartedAt: attemptStartedAt,
      },
    });

    let parsed;
    try {
      parsed = await this.parser.parse(file);
    } catch (error) {
      await this.prisma.importBatch.updateMany({
        where: { id: batch.id, datasetAttemptInvalidatedAt: null },
        data: {
          status: 'FAILED',
          errorSummary: jsonInput({ code: 'DATASET_PARSE_FAILED' }),
        },
      });
      throw error;
    }
    const sheetMetadata: SheetMetadata[] = parsed.sheets.map((sheet) => ({
      key: sheet.key,
      name: sheet.name,
      columns: sheet.columns,
      headerFingerprint: sheet.headerFingerprint,
      rowCount: sheet.rows.length,
    }));
    const selectedSheet =
      parsed.sheets.length === 1 ? parsed.sheets[0]!.key : null;
    const mapping = {
      dataset: true,
      format: parsed.format,
      sheets: sheetMetadata,
    };
    await this.prisma.$transaction(
      async (tx) => {
        await lockLifecycle(tx);
        const currentAttempt = await tx.importBatch.findFirst({
          where: {
            id: batch.id,
            importedByUserId: actorId,
            datasetAttemptInvalidatedAt: null,
            status: 'PREVIEW',
          },
        });
        if (!currentAttempt) throw this.staleAttempt();
        await requireWritableCampaign(tx, campaignId);
        if (target) {
          const currentTarget = await tx.dataset.findFirst({
            where: {
              id: target.id,
              campaignId,
              version: target.version,
              managementCapability: 'MANAGEABLE',
            },
          });
          if (!currentTarget) throw this.staleDataset();
        }
        await tx.importBatch.update({
          where: { id: batch.id },
          data: {
            status: selectedSheet ? 'READY' : 'PREVIEW',
            totalRows: parsed.sheets.reduce(
              (sum, sheet) => sum + sheet.rows.length,
              0,
            ),
            acceptedRows: selectedSheet ? parsed.sheets[0]!.rows.length : 0,
            mapping: jsonInput(mapping),
            selectedSheet,
          },
        });
        const stagedRows = parsed.sheets.flatMap((sheet) =>
          sheet.rows.map((row) => ({ sheetKey: sheet.key, row })),
        );
        for (let offset = 0; offset < stagedRows.length; offset += 1000) {
          await tx.importRow.createMany({
            data: stagedRows
              .slice(offset, offset + 1000)
              .map(({ sheetKey, row }) => ({
                importBatchId: batch.id,
                sourceRowNumber: row.sourceRowNumber,
                sheetName: sheetKey,
                status: 'PENDING' as const,
                rawData: jsonInput({}),
                rawCells: jsonInput(row.cells),
                normalizedPreview: jsonInput(row.typedCells),
              })),
          });
        }
      },
      { timeout: 60000 },
    );

    const response = await this.attemptPreview(batch.id, actorId);
    return { ...response, format: parsed.format };
  }

  async selectSheet(attemptId: string, selectedSheet: string, actorId: string) {
    const batch = await this.getAttempt(attemptId, actorId);
    const metadata = this.attemptSheets(batch.mapping);
    const sheet = metadata.find((item) => item.key === selectedSheet);
    if (!sheet)
      throw new BadRequestException({
        code: 'DATASET_SHEET_NOT_FOUND',
        message: 'Choose one of the worksheets shown for this file.',
      });
    await this.prisma.importBatch.update({
      where: { id: attemptId },
      data: {
        selectedSheet,
        acceptedRows: sheet.rowCount,
        status: 'READY',
      },
    });
    return this.attemptPreview(attemptId, actorId);
  }

  async setReplacementTarget(
    attemptId: string,
    dto: ReplacementTargetDto,
    actorId: string,
  ) {
    await this.assertCanReplace(actorId);
    const batch = await this.getAttempt(attemptId, actorId);
    if (!batch.selectedSheet)
      throw new ConflictException({
        code: 'DATASET_SHEET_REQUIRED',
        message: 'Choose a worksheet before replacing a dataset.',
      });
    const target = await this.prisma.dataset.findFirst({
      where: {
        id: dto.targetDatasetId,
        campaignId: batch.datasetCampaignId ?? undefined,
        managementCapability: 'MANAGEABLE',
        campaign: { archivedAt: null },
      },
    });
    if (!target) throw this.notFound();
    if (target.version !== dto.expectedVersion) throw this.staleDataset();
    const duplicate = await this.prisma.dataset.findFirst({
      where: {
        campaignId: target.campaignId,
        sourceChecksum: batch.checksum,
        worksheetKey: batch.selectedSheet,
        id: { not: target.id },
      },
      select: { id: true },
    });
    if (duplicate)
      throw new ConflictException({
        code: 'DATASET_DUPLICATE_EXISTS',
        message:
          'This file and worksheet already belong to another dataset in this campaign.',
        existingDatasetId: duplicate.id,
      });
    await this.prisma.importBatch.update({
      where: { id: attemptId },
      data: {
        datasetOperation: 'REPLACE',
        targetDatasetId: target.id,
        expectedDatasetVersion: dto.expectedVersion,
      },
    });
    return this.attemptPreview(attemptId, actorId);
  }

  async confirm(attemptId: string, actorId: string) {
    await this.assertCanImport(actorId);
    return this.prisma.$transaction(
      async (tx) => {
        await lockLifecycle(tx);
        await tx.$queryRaw`SELECT id FROM social_media_dashboard."ImportBatch" WHERE id = ${attemptId}::uuid FOR UPDATE`;
        const batch = await tx.importBatch.findFirst({
          where: { id: attemptId, importedByUserId: actorId },
          include: {
            rows: {
              where: { sheetName: { not: null } },
              orderBy: { sourceRowNumber: 'asc' },
            },
          },
        });
        if (!batch || !batch.datasetOperation || !batch.datasetCampaignId)
          throw this.attemptNotFound();
        if (
          batch.datasetAttemptInvalidatedAt ||
          !['PREVIEW', 'READY'].includes(batch.status)
        )
          throw this.staleAttempt();
        if (!batch.selectedSheet)
          throw new ConflictException({
            code: 'DATASET_SHEET_REQUIRED',
            message: 'Choose a worksheet before importing this file.',
          });
        await this.assertCanImport(actorId, tx);
        await requireWritableCampaign(tx, batch.datasetCampaignId);
        const deletionFence = await tx.datasetDeletionFence.findUnique({
          where: {
            campaignId_sourceChecksum_worksheetKey: {
              campaignId: batch.datasetCampaignId,
              sourceChecksum: batch.checksum,
              worksheetKey: batch.selectedSheet,
            },
          },
        });
        if (
          deletionFence &&
          batch.datasetAttemptStartedAt &&
          deletionFence.deletedAt > batch.datasetAttemptStartedAt
        )
          throw this.staleAttempt();
        const rows = batch.rows.filter(
          (row) => row.sheetName === batch.selectedSheet,
        );
        const columns = this.attemptSheet(
          batch.mapping,
          batch.selectedSheet,
        ).columns;
        if (!rows.length || !rows.some((row) => meaningful(row.rawCells)))
          throw new BadRequestException({
            code: 'DATASET_EMPTY',
            message:
              'The selected worksheet must contain at least one non-empty data row.',
          });

        const duplicate = await tx.dataset.findFirst({
          where: {
            campaignId: batch.datasetCampaignId,
            sourceChecksum: batch.checksum,
            worksheetKey: batch.selectedSheet,
            ...(batch.datasetOperation === 'REPLACE' && batch.targetDatasetId
              ? { id: { not: batch.targetDatasetId } }
              : {}),
          },
        });
        if (duplicate)
          throw await this.duplicateResponse(duplicate, actorId, tx);

        if (batch.datasetOperation === 'CREATE') {
          if (batch.targetDatasetId) throw this.staleAttempt();
          const created = await tx.dataset.create({
            data: {
              campaignId: batch.datasetCampaignId,
              name: filenameLabel(batch.originalFilename),
              sourceFilename: batch.originalFilename,
              sourceChecksum: batch.checksum,
              worksheetKey: batch.selectedSheet,
              worksheetName: this.attemptSheet(
                batch.mapping,
                batch.selectedSheet,
              ).name,
              currentRevision: 1,
              version: 1,
              createdByUserId: actorId,
            },
          });
          const revision = await tx.datasetRevision.create({
            data: {
              datasetId: created.id,
              revisionNumber: 1,
              importBatchId: batch.id,
              sourceFilename: batch.originalFilename,
              sourceChecksum: batch.checksum,
              worksheetKey: batch.selectedSheet,
              worksheetName: this.attemptSheet(
                batch.mapping,
                batch.selectedSheet,
              ).name,
              headerFingerprint: this.attemptSheet(
                batch.mapping,
                batch.selectedSheet,
              ).headerFingerprint,
              columns: jsonInput(columns),
              rowCount: rows.length,
            },
          });
          await this.createDatasetRows(tx, revision.id, rows);
          await this.finishAttempt(tx, batch.id, rows.length);
          await this.audit(tx, actorId, 'DATASET_IMPORT', created.id, {
            campaignId: batch.datasetCampaignId,
            revision: 1,
            rowCount: rows.length,
          });
          return this.datasetResult(tx, created.id, actorId);
        }

        if (!batch.targetDatasetId || !batch.expectedDatasetVersion)
          throw this.staleAttempt();
        const current = await tx.dataset.findFirst({
          where: {
            id: batch.targetDatasetId,
            campaignId: batch.datasetCampaignId,
            managementCapability: 'MANAGEABLE',
            campaign: { archivedAt: null },
          },
        });
        if (!current) throw this.staleAttempt();
        if (current.version !== batch.expectedDatasetVersion)
          throw this.staleDataset();
        await this.assertCanReplace(actorId, tx);
        const nextRevision = current.currentRevision + 1;
        const revision = await tx.datasetRevision.create({
          data: {
            datasetId: current.id,
            revisionNumber: nextRevision,
            importBatchId: batch.id,
            sourceFilename: batch.originalFilename,
            sourceChecksum: batch.checksum,
            worksheetKey: batch.selectedSheet,
            worksheetName: this.attemptSheet(batch.mapping, batch.selectedSheet)
              .name,
            headerFingerprint: this.attemptSheet(
              batch.mapping,
              batch.selectedSheet,
            ).headerFingerprint,
            columns: jsonInput(columns),
            rowCount: rows.length,
          },
        });
        await this.createDatasetRows(tx, revision.id, rows);
        const updated = await tx.dataset.updateMany({
          where: { id: current.id, version: batch.expectedDatasetVersion },
          data: {
            currentRevision: nextRevision,
            version: { increment: 1 },
            name: filenameLabel(batch.originalFilename),
            sourceFilename: batch.originalFilename,
            sourceChecksum: batch.checksum,
            worksheetKey: batch.selectedSheet,
            worksheetName: this.attemptSheet(batch.mapping, batch.selectedSheet)
              .name,
          },
        });
        if (!updated.count) throw this.staleDataset();
        await this.finishAttempt(tx, batch.id, rows.length);
        await this.audit(tx, actorId, 'DATASET_REPLACE', current.id, {
          campaignId: current.campaignId,
          previousRevision: current.currentRevision,
          revision: nextRevision,
          rowCount: rows.length,
        });
        return this.datasetResult(tx, current.id, actorId);
      },
      { timeout: 60000 },
    );
  }

  async delete(datasetId: string, actorId: string) {
    await this.assertCanDelete(actorId);
    return this.prisma.$transaction(
      async (tx) => {
        await lockLifecycle(tx);
        const dataset = await tx.dataset.findUnique({
          where: { id: datasetId },
        });
        if (!dataset) throw this.notFound();
        await requireWritableCampaign(tx, dataset.campaignId);
        if (dataset.managementCapability !== 'MANAGEABLE')
          throw this.protectedDataset();
        await this.assertCanDelete(actorId, tx);
        const now = new Date();
        await tx.importBatch.updateMany({
          where: {
            datasetAttemptInvalidatedAt: null,
            status: { in: ['PREVIEW', 'READY', 'IMPORTING'] },
            OR: [
              { targetDatasetId: datasetId },
              {
                datasetCampaignId: dataset.campaignId,
                checksum: dataset.sourceChecksum,
                OR: [
                  { selectedSheet: dataset.worksheetKey },
                  { selectedSheet: null },
                ],
              },
            ],
          },
          data: {
            datasetAttemptInvalidatedAt: now,
            status: 'REJECTED',
            errorSummary: jsonInput({ code: 'DATASET_DELETED' }),
          },
        });
        await this.audit(tx, actorId, 'DATASET_DELETE', dataset.id, {
          campaignId: dataset.campaignId,
          revisionCount: await tx.datasetRevision.count({
            where: { datasetId },
          }),
        });
        await tx.datasetDeletionFence.upsert({
          where: {
            campaignId_sourceChecksum_worksheetKey: {
              campaignId: dataset.campaignId,
              sourceChecksum: dataset.sourceChecksum,
              worksheetKey: dataset.worksheetKey,
            },
          },
          create: {
            campaignId: dataset.campaignId,
            sourceChecksum: dataset.sourceChecksum,
            worksheetKey: dataset.worksheetKey,
            deletedAt: now,
          },
          update: { deletedAt: now },
        });
        await tx.dataset.delete({ where: { id: datasetId } });
        return { id: datasetId, deleted: true };
      },
      { timeout: 60000 },
    );
  }

  async listTemplates(actorId: string) {
    await this.currentActor(actorId);
    return this.prisma.datasetImportTemplate.findMany({
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        headerFingerprint: true,
        rules: true,
        createdByUserId: true,
        createdAt: true,
      },
    });
  }

  async createTemplate(dto: CreateDatasetTemplateDto, actorId: string) {
    await this.assertCanImport(actorId);
    if (!/^[a-f0-9]{64}$/i.test(dto.headerFingerprint))
      throw new BadRequestException({
        code: 'DATASET_TEMPLATE_INVALID',
        message: 'This import template could not be saved.',
      });
    const name = dto.name.trim();
    if (!name)
      throw new BadRequestException({
        code: 'DATASET_TEMPLATE_NAME_REQUIRED',
        message: 'Enter a name for this import template.',
      });
    return this.prisma.datasetImportTemplate.create({
      data: {
        name,
        headerFingerprint: dto.headerFingerprint.toLowerCase(),
        rules: jsonInput({
          columns: this.normalizedLabelEntries(
            (dto.rules as { columns?: DatasetColumnLabelDto[] }).columns ?? [],
          ),
        }),
        createdByUserId: actorId,
      },
      select: {
        id: true,
        name: true,
        headerFingerprint: true,
        rules: true,
        createdAt: true,
      },
    });
  }

  private async attemptPreview(attemptId: string, actorId: string) {
    const batch = await this.getAttempt(attemptId, actorId);
    const sheets = this.attemptSheets(batch.mapping);
    const selected = batch.selectedSheet
      ? (sheets.find((sheet) => sheet.key === batch.selectedSheet) ?? null)
      : null;
    const sampleRows = selected
      ? await this.prisma.importRow.findMany({
          where: { importBatchId: batch.id, sheetName: selected.key },
          orderBy: { sourceRowNumber: 'asc' },
          take: 10,
          select: { sourceRowNumber: true, rawCells: true },
        })
      : [];
    let duplicate: unknown = null;
    const matchingTemplates = selected
      ? await this.prisma.datasetImportTemplate.findMany({
          where: { headerFingerprint: selected.headerFingerprint },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, rules: true },
        })
      : [];
    if (selected) {
      const dataset = await this.prisma.dataset.findFirst({
        where: {
          campaignId: batch.datasetCampaignId ?? undefined,
          sourceChecksum: batch.checksum,
          worksheetKey: selected.key,
          ...(batch.targetDatasetId
            ? { id: { not: batch.targetDatasetId } }
            : {}),
        },
      });
      if (dataset) {
        const actor = await this.currentActor(actorId);
        const revision = await this.prisma.datasetRevision.findUnique({
          where: {
            datasetId_revisionNumber: {
              datasetId: dataset.id,
              revisionNumber: dataset.currentRevision,
            },
          },
          select: { rowCount: true },
        });
        duplicate = {
          dataset: {
            ...this.datasetCard(dataset, actor.role.code),
            rowCount: revision?.rowCount ?? 0,
          },
          actions: {
            view: true,
            replace:
              dataset.managementCapability === 'MANAGEABLE' &&
              ['ADMIN', 'MARKETING_OFFICER'].includes(actor.role.code),
          },
        };
      }
    }
    return {
      id: batch.id,
      filename: batch.originalFilename,
      operation: batch.datasetOperation,
      targetDatasetId: batch.targetDatasetId,
      expectedVersion: batch.expectedDatasetVersion,
      status: batch.status,
      sheetSelectionRequired: sheets.length > 1 && !batch.selectedSheet,
      selectedSheet: batch.selectedSheet,
      sheets: sheets.map(({ key, name, rowCount }) => ({
        key,
        name,
        rowCount,
      })),
      selected: selected
        ? {
            ...selected,
            sampleRows: sampleRows.map((row) => ({
              ...row,
              cells: row.rawCells,
            })),
          }
        : null,
      duplicate,
      matchingTemplates,
    };
  }

  private normalizedLabelEntries(entries: DatasetColumnLabelDto[]) {
    if (!Array.isArray(entries) || entries.length > 500)
      throw this.templateInvalid();
    const ids = new Set<string>();
    return entries.map((entry) => {
      if (
        !entry ||
        !/^c\d+$/.test(entry.id) ||
        ids.has(entry.id) ||
        typeof entry.label !== 'string' ||
        !entry.label.trim() ||
        entry.label.trim().length > 120
      )
        throw this.templateInvalid();
      ids.add(entry.id);
      return {
        id: entry.id,
        label: entry.label.trim(),
        ...(entry.meaning !== undefined
          ? { meaning: entry.meaning?.trim() || null }
          : {}),
        ...(entry.unit !== undefined
          ? { unit: entry.unit?.trim() || null }
          : {}),
      };
    });
  }

  private normalizedLabels(
    entries: DatasetColumnLabelDto[],
    columns: DatasetColumn[],
  ) {
    const validIds = new Set(columns.map((column) => column.id));
    const normalized = this.normalizedLabelEntries(entries);
    if (normalized.some((entry) => !validIds.has(entry.id)))
      throw this.templateInvalid();
    return new Map(normalized.map((entry) => [entry.id, entry.label]));
  }

  private async getAttempt(attemptId: string, actorId: string) {
    const batch = await this.prisma.importBatch.findFirst({
      where: {
        id: attemptId,
        importedByUserId: actorId,
        datasetOperation: { not: null },
      },
    });
    if (
      !batch ||
      batch.datasetAttemptInvalidatedAt ||
      ['REJECTED', 'FAILED'].includes(batch.status)
    )
      throw this.attemptNotFound();
    if (batch.status === 'COMPLETED')
      throw new ConflictException({
        code: 'DATASET_ATTEMPT_CONSUMED',
        message:
          'This import attempt has already been used. Upload the file again to start a new import.',
      });
    return batch;
  }

  private attemptSheets(mapping: unknown): SheetMetadata[] {
    const raw = mapping as { sheets?: unknown } | null;
    if (!Array.isArray(raw?.sheets)) return [];
    return raw.sheets.filter(
      (sheet): sheet is SheetMetadata =>
        Boolean(sheet) &&
        typeof sheet === 'object' &&
        typeof (sheet as SheetMetadata).key === 'string' &&
        typeof (sheet as SheetMetadata).name === 'string' &&
        Array.isArray((sheet as SheetMetadata).columns) &&
        typeof (sheet as SheetMetadata).rowCount === 'number',
    );
  }

  private attemptSheet(mapping: unknown, sheetKey: string) {
    const sheet = this.attemptSheets(mapping).find(
      (item) => item.key === sheetKey,
    );
    if (!sheet) throw this.staleAttempt();
    return sheet;
  }

  private async createDatasetRows(
    tx: Prisma.TransactionClient,
    revisionId: string,
    rows: Array<{
      sourceRowNumber: number;
      rawCells: Prisma.JsonValue | null;
      normalizedPreview: Prisma.JsonValue | null;
    }>,
  ) {
    for (let offset = 0; offset < rows.length; offset += 1000) {
      await tx.datasetRow.createMany({
        data: rows.slice(offset, offset + 1000).map((row) => ({
          id: randomUUID(),
          revisionId,
          sourceRowNumber: row.sourceRowNumber,
          cells: jsonInput(row.rawCells ?? []),
          typedCells: jsonInput(row.normalizedPreview ?? []),
        })),
      });
    }
  }

  private async finishAttempt(
    tx: Prisma.TransactionClient,
    attemptId: string,
    rowCount: number,
  ) {
    await tx.importRow.deleteMany({ where: { importBatchId: attemptId } });
    await tx.importBatch.update({
      where: { id: attemptId },
      data: {
        status: 'COMPLETED',
        acceptedRows: rowCount,
        rejectedRows: 0,
        completedAt: new Date(),
      },
    });
  }

  private async datasetResult(
    tx: Prisma.TransactionClient,
    datasetId: string,
    actorId: string,
  ) {
    const dataset = await tx.dataset.findUnique({
      where: { id: datasetId },
      include: { campaign: { select: { id: true, name: true } } },
    });
    if (!dataset) throw this.notFound();
    const revision = await tx.datasetRevision.findUnique({
      where: {
        datasetId_revisionNumber: {
          datasetId,
          revisionNumber: dataset.currentRevision,
        },
      },
    });
    const actor = await this.currentActor(actorId, tx);
    return {
      ...this.datasetCard(dataset, actor.role.code),
      campaign: dataset.campaign,
      currentRevision: dataset.currentRevision,
      rowCount: revision?.rowCount ?? 0,
      columns: revision?.columns ?? [],
      headerFingerprint: revision?.headerFingerprint ?? null,
    };
  }

  private async duplicateResponse(
    dataset: {
      id: string;
      campaignId: string;
      name: string;
      sourceFilename: string;
      managementCapability: string;
      version: number;
      createdAt: Date;
    },
    actorId: string,
    tx: Prisma.TransactionClient,
  ) {
    const actor = await this.currentActor(actorId, tx);
    return new ConflictException({
      code: 'DATASET_DUPLICATE_EXISTS',
      message:
        'This file and worksheet already belong to a dataset in this campaign.',
      existingDataset: this.datasetCard(dataset, actor.role.code),
    });
  }

  private async historicalImports(campaignId: string) {
    const groups = await this.prisma.performanceRecord.groupBy({
      by: ['importBatchId'],
      where: {
        campaignPlatform: { campaignChannel: { campaignId } },
        importBatchId: { not: null },
      },
      _count: { _all: true },
    });
    const batchIds = groups.flatMap((group) =>
      group.importBatchId ? [group.importBatchId] : [],
    );
    const batches = await this.prisma.importBatch.findMany({
      where: { id: { in: batchIds } },
      select: {
        id: true,
        originalFilename: true,
        displayName: true,
        selectedSheet: true,
        createdAt: true,
      },
    });
    const recordCountByBatch = new Map(
      groups.flatMap((group) =>
        group.importBatchId
          ? [[group.importBatchId, group._count._all] as const]
          : [],
      ),
    );
    return batches
      .map((batch) => ({
        id: batch.id,
        name: batch.displayName || filenameLabel(batch.originalFilename),
        sourceFilename: batch.originalFilename,
        worksheetName: batch.selectedSheet,
        availableRecordCount: recordCountByBatch.get(batch.id) ?? 0,
        importedAt: batch.createdAt,
        originalFileAvailable: false,
        note: 'Viewing shows current campaign records linked to this import; the original file may no longer be available.',
        managementCapability: 'HISTORICAL_PROTECTED' as const,
        explanation:
          'Historical dataset — viewing is available. Replacement and deletion are unavailable because this import shares existing campaign data.',
      }))
      .sort((a, b) => b.importedAt.getTime() - a.importedAt.getTime());
  }

  private datasetCard(
    dataset: {
      id: string;
      campaignId: string;
      name: string;
      sourceFilename: string;
      sourceChecksum?: string;
      worksheetName?: string | null;
      managementCapability: string;
      version: number;
      currentRevision?: number;
      rowCount?: number;
      createdAt: Date;
    },
    roleCode: string,
  ) {
    const manageable = dataset.managementCapability === 'MANAGEABLE';
    return {
      id: dataset.id,
      campaignId: dataset.campaignId,
      name: publicDatasetName(dataset),
      sourceFilename: dataset.sourceFilename,
      worksheetName: dataset.worksheetName,
      managementCapability: dataset.managementCapability,
      version: dataset.version,
      currentRevision: dataset.currentRevision,
      rowCount: dataset.rowCount,
      createdAt: dataset.createdAt,
      capabilities: {
        view: true,
        replace:
          manageable && ['ADMIN', 'MARKETING_OFFICER'].includes(roleCode),
        delete: manageable && roleCode === 'ADMIN',
      },
      ...(manageable
        ? {}
        : {
            explanation:
              'Historical dataset — viewing is available. Replacement and deletion are unavailable because this import shares existing campaign data.',
          }),
    };
  }

  private resolveDateColumn(columns: DatasetColumn[], id: string) {
    const match = /^c(\d+)$/.exec(id);
    if (!match) throw this.dateColumnInvalid();
    const ordinal = Number(match[1]) - 1;
    if (!columns[ordinal] || columns[ordinal]!.type !== 'date')
      throw this.dateColumnInvalid();
    return ordinal;
  }

  private async currentActor(
    actorId: string,
    tx: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const actor = await tx.user.findUnique({
      where: { id: actorId },
      include: { role: true },
    });
    if (!actor?.active || !actor.role.active)
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Your account cannot perform this action.',
      });
    return actor;
  }

  private async assertCanImport(
    actorId: string,
    tx: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const actor = await this.currentActor(actorId, tx);
    if (!['ADMIN', 'MARKETING_OFFICER'].includes(actor.role.code))
      throw this.forbidden();
    return actor;
  }

  private async assertCanReplace(
    actorId: string,
    tx: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    return this.assertCanImport(actorId, tx);
  }

  private async assertCanDelete(
    actorId: string,
    tx: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const actor = await this.currentActor(actorId, tx);
    if (actor.role.code !== 'ADMIN') throw this.forbidden();
    return actor;
  }

  private async audit(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    action: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    await tx.auditLog.create({
      data: {
        actorUserId,
        action,
        entityType: 'Dataset',
        entityId,
        metadata: jsonInput(metadata),
      },
    });
  }

  private notFound(code = 'DATASET_NOT_FOUND') {
    return new NotFoundException({
      code,
      message: 'The requested item is not available.',
    });
  }

  private attemptNotFound() {
    return new NotFoundException({
      code: 'DATASET_ATTEMPT_NOT_FOUND',
      message: 'Import attempt not found.',
    });
  }

  private staleAttempt() {
    return new ConflictException({
      code: 'DATASET_ATTEMPT_STALE',
      message:
        'This import attempt is no longer valid. Upload the file again to continue.',
    });
  }

  private staleDataset() {
    return new ConflictException({
      code: 'DATASET_CHANGED',
      message:
        'This dataset changed after the replacement was prepared. Review it and try again.',
    });
  }

  private protectedDataset() {
    return new ForbiddenException({
      code: 'DATASET_MANAGEMENT_UNAVAILABLE',
      message:
        'This historical dataset can be viewed, but replacement and deletion are unavailable.',
    });
  }

  private forbidden() {
    return new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'You do not have permission to perform this action.',
    });
  }

  private dateColumnInvalid() {
    return new BadRequestException({
      code: 'DATASET_DATE_COLUMN_INVALID',
      message: 'Choose a date column from this dataset.',
    });
  }

  private templateInvalid() {
    return new BadRequestException({
      code: 'DATASET_TEMPLATE_INVALID',
      message:
        'The column labels in this template are not valid for the selected file.',
    });
  }
}
