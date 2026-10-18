import {
  lockLifecycle,
  requireWritableCampaign,
  preventDeletedImport,
} from '../common/lifecycle.js';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { FileParserService } from './file-parser.service.js';
import { isBlank, suggestedMapping } from './source-aliases.js';
import { detectSourceAdapter } from './source-adapters.js';
import {
  mergeRepeatedDailyMetrics,
  type ImportMetricRule,
  type WeightedMetricState,
} from './daily-metric-aggregation.js';
import type { NormalizedImportRow, RowIssue } from './import.types.js';
import { summarizeImport } from './import-summary.js';
import type { MapImportDto } from './dto/map-import.dto.js';

type UploadFile = {
  originalname: string;
  mimetype?: string;
  size: number;
  buffer: Buffer;
};

function json(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function asText(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim();
}

export function parseDate(value: unknown) {
  const text = asText(value);
  const iso = /^(\d{4}-\d{2}-\d{2})(?:[T ].*)?$/.exec(text)?.[1];
  if (iso) {
    const date = new Date(`${iso}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const monthDayYear = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+.*)?$/.exec(
    text,
  );
  if (monthDayYear) {
    const month = Number(monthDayYear[1]) - 1;
    const day = Number(monthDayYear[2]);
    const year = Number(monthDayYear[3]);
    const date = new Date(Date.UTC(year, month, day));
    if (
      month < 0 ||
      month > 11 ||
      Number.isNaN(date.getTime()) ||
      date.getUTCMonth() !== month ||
      date.getUTCDate() !== day
    )
      return null;
    return date;
  }
  const named =
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})(?:\s+.*)?$/i.exec(
      text,
    );
  if (!named) return null;
  const month = [
    'jan',
    'feb',
    'mar',
    'apr',
    'may',
    'jun',
    'jul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec',
  ].indexOf(named[1].toLowerCase());
  const date = new Date(Date.UTC(Number(named[3]), month, Number(named[2])));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== Number(named[2])
  )
    return null;
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseNumber(value: unknown) {
  if (isBlank(value)) return null;
  const text =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/,/g, '').replace(/%$/, ''));
  return typeof text === 'number' && Number.isFinite(text) ? text : null;
}

@Injectable()
export class ImportsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FileParserService) private readonly parser: FileParserService,
  ) {}

  async preview(file: UploadFile, actorId: string) {
    const parsed = await this.parser.parse(file);
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    const completed = await this.prisma.importBatch.findFirst({
      where: { checksum, status: 'COMPLETED' },
    });
    const completedImports = await this.prisma.importBatch.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      take: 50,
      select: { displayName: true, originalFilename: true, mapping: true },
    });
    const sheetPreviews = parsed.sheets.flatMap((sheet) => {
      const rows = parsed.rows.filter(
        (row) => (row.sheetName ?? parsed.sheets[0]) === sheet,
      );
      if (!rows.length) return [];
      const columns = [
        ...new Set(rows.flatMap((row) => Object.keys(row.data))),
      ];
      const adapter = detectSourceAdapter(columns);
      const mapping = adapter.suggestMapping(columns);
      const signature = columns
        .map((column) => column.trim().toLowerCase())
        .join('|');
      const previous = completedImports.find((item) => {
        const stored = item.mapping as {
          columns?: string[];
          mapping?: Record<string, string>;
        } | null;
        return (
          Array.isArray(stored?.columns) &&
          stored.columns
            .map((column) => column.trim().toLowerCase())
            .join('|') === signature &&
          stored.mapping &&
          typeof stored.mapping === 'object'
        );
      });
      const campaignColumn = Object.entries(mapping).find(
        ([, destination]) => destination === 'campaignName',
      )?.[0];
      const previousMapping = previous
        ? Object.fromEntries(
            columns.flatMap((column) => {
              const stored = (
                previous.mapping as { mapping: Record<string, string> }
              ).mapping;
              const key = Object.keys(stored).find(
                (name) =>
                  name.trim().toLowerCase() === column.trim().toLowerCase(),
              );
              return key ? [[column, stored[key]]] : [];
            }),
          )
        : undefined;
      const dateColumn = Object.entries(mapping).find(
        ([, destination]) => destination === 'recordDate',
      )?.[0];
      const dates = dateColumn
        ? rows
            .flatMap((row) => {
              const date = parseDate(row.data[dateColumn]);
              return date ? [date.toISOString().slice(0, 10)] : [];
            })
            .sort()
        : [];
      return [
        {
          sheet,
          columns,
          rowCount: rows.length,
          sampleRows: rows.slice(0, 100),
          source: { type: adapter.code, platform: adapter.platform },
          suggestedMapping: mapping,
          campaignValues: campaignColumn
            ? [
                ...new Set(
                  rows
                    .map((row) => asText(row.data[campaignColumn]))
                    .filter(Boolean),
                ),
              ]
            : [],
          dateRange: dates.length
            ? { from: dates[0], to: dates[dates.length - 1] }
            : null,
          matchingTemplate: previous
            ? {
                displayName: previous.displayName || previous.originalFilename,
                mapping: previousMapping!,
              }
            : undefined,
        },
      ];
    });
    const firstSheet = sheetPreviews[0];
    if (!firstSheet)
      throw new BadRequestException({
        code: 'IMPORT_EMPTY',
        message: 'This file has no rows to import.',
      });
    const source = firstSheet?.source ?? { type: 'GENERIC', platform: null };
    const batch = await this.prisma.importBatch.create({
      data: {
        sourceType: source.type,
        sourcePlatform: source.platform,
        displayName: file.originalname.replace(/\.[^.]+$/, '').slice(0, 180),
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        checksum,
        importedByUserId: actorId,
        totalRows: parsed.rows.length,
        mapping: json({
          mapping: firstSheet?.suggestedMapping ?? {},
          columns: firstSheet?.columns ?? parsed.columns,
          sheets: parsed.sheets,
        }),
        selectedSheet: firstSheet?.sheet,
        rows: {
          create: parsed.rows.map((row) => ({
            sourceRowNumber: row.sourceRowNumber,
            sheetName: row.sheetName ?? parsed.sheets[0],
            rawData: json(row.data),
          })),
        },
      },
    });
    return {
      id: batch.id,
      filename: batch.originalFilename,
      displayName: batch.displayName,
      format: parsed.format,
      checksum,
      duplicateCompleted: Boolean(completed),
      ...firstSheet,
      sheets: sheetPreviews.map((preview) => preview.sheet),
      sheetPreviews,
      warnings: completed
        ? [
            'This exact file was already completed and cannot be imported again.',
          ]
        : [],
    };
  }

  async map(id: string, dto: MapImportDto) {
    return this.prisma.$transaction(
      async (tx) => {
        await lockLifecycle(tx);
        await tx.$queryRaw`SELECT id FROM social_media_dashboard."ImportBatch" WHERE id = ${id}::uuid FOR UPDATE`;
        const batch = await tx.importBatch.findUnique({ where: { id } });
        if (!batch) throw new NotFoundException('Import batch not found.');
        if (batch.status === 'COMPLETED' || batch.status === 'IMPORTING')
          throw new ConflictException({
            code: 'IMPORT_ALREADY_COMPLETED',
            message: 'This import has already been completed.',
          });
        const mapping = { ...dto.mapping };
        const datasetAction = dto.datasetAction ?? 'CREATE';
        if (dto.displayName !== undefined) {
          const displayName = dto.displayName.trim();
          if (!displayName)
            throw new BadRequestException({
              code: 'IMPORT_DISPLAY_NAME_REQUIRED',
              message: 'Enter a name for this dataset or import.',
            });
          await tx.importBatch.update({
            where: { id },
            data: { displayName },
          });
        }
        const selectedSheet = dto.selectedSheet ?? batch.selectedSheet;
        const rows = await tx.importRow.findMany({
          where: {
            importBatchId: id,
            ...(selectedSheet ? { sheetName: selectedSheet } : {}),
          },
          orderBy: { sourceRowNumber: 'asc' },
        });
        if (!rows.length)
          throw new BadRequestException({
            code: 'IMPORT_SHEET_EMPTY',
            message: 'The selected sheet has no rows.',
          });

        // Resolve global import context before evaluating row-level metric rules.
        // A missing platform is one actionable context error, not one rejection per row.
        if (!dto.platformId)
          throw new BadRequestException({
            code: 'IMPORT_PLATFORM_REQUIRED',
            message:
              batch.sourceType === 'EMAIL'
                ? 'Select an Email platform before validating this import.'
                : 'Select a platform before validating this import.',
          });
        const selectedPlatform = await tx.platform.findUnique({
          where: { id: dto.platformId },
          include: { channel: true },
        });
        if (!selectedPlatform?.active || !selectedPlatform.channel.active)
          throw new BadRequestException({
            code: 'IMPORT_PLATFORM_INACTIVE',
            message: 'Select an active platform before validating this import.',
          });
        if (!Object.values(mapping).includes('recordDate'))
          throw new BadRequestException({
            code: 'IMPORT_DATE_MAPPING_REQUIRED',
            message:
              'Map a source column to Record date before validating this import.',
          });
        const campaignSourceColumn = Object.entries(mapping).find(
          ([, destination]) => destination === 'campaignName',
        )?.[0];
        const requiredCampaignValues = campaignSourceColumn
          ? Array.from(
              new Set(
                rows
                  .map((row) =>
                    asText(
                      (row.rawData as Record<string, unknown>)[
                        campaignSourceColumn
                      ],
                    ),
                  )
                  .filter((value): value is string => Boolean(value)),
              ),
            )
          : [];
        if (requiredCampaignValues.length) {
          const missingCampaigns = requiredCampaignValues.filter(
            (value) => !dto.campaignMappings?.[value] && !dto.campaignId,
          );
          if (missingCampaigns.length)
            throw new BadRequestException({
              code: 'IMPORT_CAMPAIGN_REQUIRED',
              message:
                'Map every source campaign before validating this import.',
            });
        } else if (!dto.campaignId) {
          throw new BadRequestException({
            code: 'IMPORT_CAMPAIGN_REQUIRED',
            message: 'Select or map a campaign before validating this import.',
          });
        }

        const contextCache = new Map<
          string,
          {
            campaignId: string;
            platformId: string;
            channelId: string;
            campaignStart: Date;
            campaignEnd: Date | null;
            metrics: Map<
              string,
              {
                id: string;
                active: boolean;
                inputEnabled: boolean;
                kind: ImportMetricRule['kind'];
                unit: string;
                aggregationStrategy: ImportMetricRule['aggregationStrategy'];
              }
            >;
          }
        >();
        const canonicalByKey = new Map<string, NormalizedImportRow>();
        const weightedStates = new WeakMap<
          NormalizedImportRow,
          WeightedMetricState
        >();
        const updates: Array<{
          id: string;
          sourceRowNumber: number;
          status: 'ACCEPTED' | 'REJECTED' | 'CONFLICT';
          normalized: NormalizedImportRow | null;
          errors: RowIssue[];
          warnings: RowIssue[];
        }> = [];

        for (const row of rows) {
          const raw = row.rawData as Record<string, unknown>;
          const errors: RowIssue[] = [];
          const warnings: RowIssue[] = [];
          const destinationValue = (destination: string) => {
            const sourceColumn = Object.entries(mapping).find(
              ([, value]) => value === destination,
            )?.[0];
            return sourceColumn ? raw[sourceColumn] : undefined;
          };
          const recordDate = parseDate(destinationValue('recordDate'));
          if (!recordDate)
            errors.push({
              code: 'INVALID_DATE',
              message: 'A valid YYYY-MM-DD date is required.',
            });
          const campaignName =
            asText(destinationValue('campaignName')) || undefined;
          const campaignId =
            campaignName && dto.campaignMappings?.[campaignName]
              ? dto.campaignMappings[campaignName]
              : dto.campaignId;
          if (!campaignId)
            errors.push({
              code: 'CAMPAIGN_UNRESOLVED',
              message: 'Select or map an existing campaign.',
            });
          if (!dto.platformId)
            errors.push({
              code: 'PLATFORM_UNRESOLVED',
              message: 'Select an existing platform.',
            });
          let context:
            | (typeof contextCache extends Map<string, infer V> ? V : never)
            | undefined;
          const contextKey = `${campaignId ?? ''}:${dto.platformId ?? ''}`;
          if (campaignId && dto.platformId && !contextCache.has(contextKey)) {
            const found = await tx.campaignPlatform.findFirst({
              where: {
                platformId: dto.platformId,
                campaignChannel: { campaignId },
              },
              include: {
                platform: true,
                campaignChannel: {
                  include: {
                    campaign: true,
                    channel: {
                      include: {
                        channelMetrics: { include: { metricDefinition: true } },
                      },
                    },
                  },
                },
              },
            });
            if (!found)
              errors.push({
                code: 'CAMPAIGN_PLATFORM_NOT_FOUND',
                message: 'The selected campaign and platform are not linked.',
              });
            else
              contextCache.set(contextKey, {
                campaignId,
                platformId: dto.platformId,
                channelId: found.campaignChannel.channelId,
                campaignStart: found.campaignChannel.campaign.startDate,
                campaignEnd: found.campaignChannel.campaign.endDate,
                metrics: new Map(
                  found.campaignChannel.channel.channelMetrics.map((item) => [
                    item.metricDefinition.code,
                    {
                      id: item.metricDefinition.id,
                      active: item.active && item.metricDefinition.active,
                      inputEnabled: item.inputEnabled,
                      kind: item.metricDefinition.kind,
                      unit: item.metricDefinition.unit,
                      aggregationStrategy:
                        item.metricDefinition.aggregationStrategy,
                    },
                  ]),
                ),
              });
          }
          context = contextCache.get(contextKey);
          if (
            recordDate &&
            context &&
            (recordDate > new Date() ||
              recordDate < context.campaignStart ||
              (context.campaignEnd && recordDate > context.campaignEnd))
          )
            errors.push({
              code:
                recordDate > new Date()
                  ? 'FUTURE_RECORD_DATE'
                  : 'RECORD_OUTSIDE_CAMPAIGN',
              message:
                recordDate > new Date()
                  ? 'Performance records cannot be future dated.'
                  : 'Record date must fall within the campaign dates.',
            });
          const metrics: Record<string, number> = {};
          for (const [sourceColumn, destination] of Object.entries(mapping)) {
            if (
              !destination ||
              ['recordDate', 'campaignName', 'sourceRecordId'].includes(
                destination,
              )
            )
              continue;
            const value = parseNumber(raw[sourceColumn]);
            if (value === null) continue;
            const definition = context?.metrics.get(destination);
            if (
              !definition ||
              !definition.active ||
              !definition.inputEnabled ||
              definition.kind !== 'RAW'
            )
              errors.push({
                code: 'INVALID_RAW_METRIC',
                message: `${destination} is not an applicable raw metric for the selected channel.`,
              });
            else if (
              value < 0 ||
              (definition.unit === 'POSITION' && value <= 0) ||
              (definition.unit === 'COUNT' && !Number.isInteger(value))
            )
              errors.push({
                code: 'INVALID_METRIC_VALUE',
                message: `${destination} has an invalid value.`,
              });
            else metrics[destination] = value;
          }
          if (
            metrics.EMAIL_SENT !== undefined &&
            metrics.EMAIL_DELIVERED !== undefined &&
            metrics.EMAIL_DELIVERED > metrics.EMAIL_SENT
          )
            errors.push({
              code: 'EMAIL_DELIVERED_EXCEEDS_SENT',
              message: 'Delivered emails cannot exceed sent emails.',
            });
          let normalized: NormalizedImportRow | null =
            recordDate && campaignId && dto.platformId && context
              ? {
                  sourceRowNumber: row.sourceRowNumber,
                  sheetName: row.sheetName ?? undefined,
                  recordDate: recordDate.toISOString().slice(0, 10),
                  campaignId,
                  platformId: dto.platformId,
                  metrics,
                  sourceRecordId:
                    asText(destinationValue('sourceRecordId')) || undefined,
                  campaignName,
                }
              : null;
          const key = normalized
            ? `${normalized.campaignId}:${normalized.platformId}:${normalized.recordDate}`
            : '';
          if (normalized && !errors.length) {
            const canonical = canonicalByKey.get(key);
            if (canonical) {
              const aggregationState = weightedStates.get(canonical) ?? {};
              const aggregation = mergeRepeatedDailyMetrics(
                canonical.metrics,
                normalized.metrics,
                context!.metrics,
                aggregationState,
              );
              if (aggregation.errors.length)
                errors.push({
                  code: 'UNDEFINED_METRIC_AGGREGATION',
                  message: `Repeated daily metric aggregation is undefined for ${aggregation.errors.join(', ')}.`,
                });
              else {
                canonical.metrics = aggregation.values;
                warnings.push({
                  code: 'DUPLICATE_IMPORT_ROW_MERGED',
                  message: `Metrics were combined using their approved aggregation strategies with source row ${canonical.sourceRowNumber}.`,
                });
                weightedStates.set(canonical, aggregationState);
              }
              normalized = {
                ...normalized,
                metrics: {},
                mergedIntoSourceRowNumber: canonical.sourceRowNumber,
              };
            } else canonicalByKey.set(key, normalized);
          }
          let status: 'ACCEPTED' | 'REJECTED' | 'CONFLICT' = errors.length
            ? 'REJECTED'
            : 'ACCEPTED';
          if (
            normalized &&
            !normalized.mergedIntoSourceRowNumber &&
            !errors.length
          ) {
            const contextRecord = await tx.campaignPlatform.findFirstOrThrow({
              where: {
                platformId: normalized.platformId,
                campaignChannel: { campaignId: normalized.campaignId },
              },
            });
            const existing = await tx.performanceRecord.findUnique({
              where: {
                campaignPlatformId_recordDate: {
                  campaignPlatformId: contextRecord.id,
                  recordDate: recordDate!,
                },
              },
            });
            if (existing) {
              const existingValues = await tx.performanceMetricValue.findMany({
                where: { performanceRecordId: existing.id },
                include: { metricDefinition: true },
              });
              const existingCodes = new Set(
                existingValues.map((value) => value.metricDefinition.code),
              );
              if (existing.status === 'ARCHIVED') {
                status = 'CONFLICT';
                errors.push({
                  code: 'EXISTING_RECORD_CONFLICT',
                  message:
                    existing.status === 'ARCHIVED'
                      ? 'An archived record already occupies this date and context.'
                      : 'An existing metric value would be overwritten.',
                });
              } else if (datasetAction === 'MERGE') {
                const incoming = Object.entries(normalized.metrics);
                const existingByCode = new Map(
                  existingValues.map((value) => [
                    value.metricDefinition.code,
                    Number(value.value),
                  ]),
                );
                const conflicts = incoming.filter(
                  ([code, value]) =>
                    existingByCode.has(code) &&
                    existingByCode.get(code) !== value,
                );
                if (conflicts.length) {
                  status = 'CONFLICT';
                  errors.push({
                    code: 'EXISTING_METRIC_CONFLICT',
                    message: 'A merged metric has a different existing value.',
                  });
                } else {
                  for (const [code] of incoming)
                    if (existingCodes.has(code))
                      delete normalized.metrics[code];
                  warnings.push({
                    code: 'MERGEABLE_RECORD',
                    message:
                      'Existing matching metrics are unchanged; new metrics will be added.',
                  });
                }
              } else
                warnings.push({
                  code: 'EXISTING_RECORD_CONFLICT',
                  message:
                    datasetAction === 'APPEND'
                      ? 'Append mode cannot add another row for an existing date.'
                      : 'A record already exists for this date and context.',
                });
              if (datasetAction !== 'MERGE' && existing.status !== 'ARCHIVED') {
                status = 'CONFLICT';
                errors.push({
                  code: 'EXISTING_RECORD_CONFLICT',
                  message:
                    datasetAction === 'APPEND'
                      ? 'Append mode cannot add another row for an existing date.'
                      : 'A record already exists for this date and context.',
                });
                warnings.pop();
              }
            }
          }
          updates.push({
            id: row.id,
            sourceRowNumber: row.sourceRowNumber,
            status,
            normalized,
            errors,
            warnings,
          });
        }
        const acceptedRows = updates.filter(
          (item) => item.status === 'ACCEPTED',
        ).length;
        const rejectedRows = updates.filter(
          (item) => item.status !== 'ACCEPTED',
        ).length;
        const warningCount = updates.reduce(
          (sum, item) => sum + item.warnings.length,
          0,
        );
        await Promise.all([
          ...updates.map((item) =>
            tx.importRow.update({
              where: { id: item.id },
              data: {
                status: item.status,
                normalizedPreview: item.normalized
                  ? json(item.normalized)
                  : undefined,
                errors: item.errors.length ? json(item.errors) : undefined,
                warnings: item.warnings.length
                  ? json(item.warnings)
                  : undefined,
              },
            }),
          ),
          tx.importBatch.update({
            where: { id },
            data: {
              status: acceptedRows ? 'READY' : 'REJECTED',
              acceptedRows,
              rejectedRows,
              warningCount,
              mapping: json({
                ...dto,
                columns: [
                  ...new Set(
                    rows.flatMap((row) =>
                      Object.keys(row.rawData as Record<string, unknown>),
                    ),
                  ),
                ],
              }),
              selectedSheet,
            },
          }),
        ]);
        return {
          id,
          status: acceptedRows ? 'READY' : 'REJECTED',
          totalRows: updates.length,
          acceptedRows,
          rejectedRows,
          warningCount,
          summary: summarizeImport(
            updates
              .filter((item) => item.status === 'ACCEPTED' && item.normalized)
              .map((item) => item.normalized!),
          ),
          rows: updates.map((item) => ({
            sourceRowNumber: item.sourceRowNumber,
            status: item.status,
            errors: item.errors,
            warnings: item.warnings,
          })),
        };
      },
      { timeout: 60000 },
    );
  }

  async confirm(id: string) {
    const batch = await this.getBatch(id);
    if (batch.status !== 'READY')
      throw new ConflictException({
        code: 'IMPORT_NOT_READY',
        message: 'The import must be mapped and validated before confirmation.',
      });
    const duplicate = await this.prisma.importBatch.findFirst({
      where: { checksum: batch.checksum, status: 'COMPLETED', id: { not: id } },
    });
    if (duplicate)
      throw new ConflictException({
        code: 'DUPLICATE_IMPORT_FILE',
        message: 'This exact file was already imported successfully.',
      });
    const claimed = await this.prisma.importBatch.updateMany({
      where: { id, status: 'READY' },
      data: { status: 'IMPORTING' },
    });
    if (!claimed.count)
      throw new ConflictException('Import is already processing.');
    try {
      const rows = await this.prisma.importRow.findMany({
        where: { importBatchId: id, status: 'ACCEPTED' },
        orderBy: { sourceRowNumber: 'asc' },
      });
      await this.prisma.$transaction(async (tx) => {
        await lockLifecycle(tx);
        const duplicateNow = await tx.importBatch.findFirst({
          where: {
            checksum: batch.checksum,
            status: 'COMPLETED',
            id: { not: id },
          },
        });
        if (duplicateNow)
          throw new ConflictException('This file was already imported.');
        for (const row of rows) {
          const normalized =
            row.normalizedPreview as unknown as NormalizedImportRow;
          if (normalized.mergedIntoSourceRowNumber) continue;
          await requireWritableCampaign(tx, normalized.campaignId);
          const context = await tx.campaignPlatform.findFirstOrThrow({
            where: {
              platformId: normalized.platformId,
              campaignChannel: { campaignId: normalized.campaignId },
            },
          });
          await preventDeletedImport(
            tx,
            context.id,
            new Date(`${normalized.recordDate}T00:00:00.000Z`),
          );
          const record = await tx.performanceRecord.findUnique({
            where: {
              campaignPlatformId_recordDate: {
                campaignPlatformId: context.id,
                recordDate: new Date(`${normalized.recordDate}T00:00:00.000Z`),
              },
            },
          });
          if (!record) {
            const created = await tx.performanceRecord.create({
              data: {
                campaignPlatformId: context.id,
                recordDate: new Date(`${normalized.recordDate}T00:00:00.000Z`),
                createdByUserId: batch.importedByUserId,
                updatedByUserId: batch.importedByUserId,
                importBatchId: id,
              },
            });
            for (const [code, value] of Object.entries(normalized.metrics)) {
              const definition = await tx.metricDefinition.findUniqueOrThrow({
                where: { code },
              });
              await tx.performanceMetricValue.create({
                data: {
                  performanceRecordId: created.id,
                  metricDefinitionId: definition.id,
                  value,
                },
              });
            }
          } else {
            if (record.status !== 'ACTIVE')
              throw new ConflictException(
                'Archived records cannot be modified by import.',
              );
            if (Object.keys(normalized.metrics).length)
              await tx.performanceRecord.update({
                where: { id: record.id },
                data: {
                  integrationManaged: false,
                  updatedByUserId: batch.importedByUserId,
                },
              });
            for (const [code, value] of Object.entries(normalized.metrics)) {
              const definition = await tx.metricDefinition.findUniqueOrThrow({
                where: { code },
              });
              await tx.performanceMetricValue.create({
                data: {
                  performanceRecordId: record.id,
                  metricDefinitionId: definition.id,
                  value,
                },
              });
            }
          }
        }
        await tx.importBatch.update({
          where: { id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: batch.importedByUserId,
            action: 'IMPORT_COMPLETED',
            entityType: 'ImportBatch',
            entityId: id,
            metadata: json({
              totalRows: batch.totalRows,
              acceptedRows: batch.acceptedRows,
              rejectedRows: batch.rejectedRows,
            }),
          },
        });
      });
    } catch (error) {
      await this.prisma.importBatch.update({
        where: { id },
        data: {
          status: 'FAILED',
          errorSummary: json({
            message: error instanceof Error ? error.message : 'Import failed.',
          }),
        },
      });
      throw error;
    }
    const accepted = await this.prisma.importRow.findMany({
      where: { importBatchId: id, status: 'ACCEPTED' },
      orderBy: { sourceRowNumber: 'asc' },
    });
    return {
      ...(await this.getBatch(id)),
      summary: summarizeImport(
        accepted.map(
          (row) => row.normalizedPreview as unknown as NormalizedImportRow,
        ),
      ),
    };
  }

  async remove(id: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      await lockLifecycle(tx);
      // Serialize deletion with confirmation/status transitions for this batch.
      await tx.$queryRaw`SELECT id FROM social_media_dashboard."ImportBatch" WHERE id = ${id}::uuid FOR UPDATE`;
      const batch = await tx.importBatch.findUnique({ where: { id } });
      if (!batch)
        throw new NotFoundException({
          code: 'IMPORT_NOT_FOUND',
          message: 'Import batch not found.',
        });
      if (
        batch.status === 'COMPLETED' ||
        batch.status === 'IMPORTING' ||
        (await tx.performanceRecord.count({ where: { importBatchId: id } }))
      )
        throw new ConflictException({
          code: 'IMPORT_DELETE_PROTECTED',
          message:
            'Completed imports and imports linked to performance records must be retained for provenance. An import currently being processed cannot be deleted.',
        });
      const rows = await tx.importRow.deleteMany({
        where: { importBatchId: id },
      });
      await tx.importBatch.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: 'IMPORT_DELETED',
          entityType: 'ImportBatch',
          entityId: id,
          metadata: json({
            originalFilename: batch.originalFilename,
            status: batch.status,
            deletedRows: rows.count,
          }),
        },
      });
      return { id, deletedRows: rows.count };
    });
  }

  list() {
    return this.prisma.importBatch.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        sourceType: true,
        sourcePlatform: true,
        displayName: true,
        originalFilename: true,
        checksum: true,
        status: true,
        totalRows: true,
        acceptedRows: true,
        rejectedRows: true,
        warningCount: true,
        importedByUser: { select: { id: true, name: true } },
        createdAt: true,
        completedAt: true,
      },
    });
  }
  get(id: string) {
    return this.getBatch(id);
  }
  rows(id: string) {
    return this.prisma.importRow.findMany({
      where: { importBatchId: id },
      orderBy: { sourceRowNumber: 'asc' },
    });
  }

  private async getBatch(id: string) {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id },
      include: {
        importedByUser: { select: { id: true, name: true, email: true } },
      },
    });
    if (!batch)
      throw new NotFoundException({
        code: 'IMPORT_NOT_FOUND',
        message: 'Import batch not found.',
      });
    return batch;
  }
}
