import { Type } from 'class-transformer';
import {
  IsDateString,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class DatasetImportPreviewDto {
  @IsUUID()
  campaignId!: string;

  @IsOptional()
  @IsUUID()
  datasetId?: string;
}

export class SelectDatasetSheetDto {
  @IsString()
  @MaxLength(255)
  selectedSheet!: string;
}

export class DatasetColumnLabelDto {
  @IsString()
  @MaxLength(32)
  id!: string;

  @IsString()
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  meaning?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string | null;
}

export class UpdateDatasetColumnLabelsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DatasetColumnLabelDto)
  columns!: DatasetColumnLabelDto[];
}

export class CompareDatasetColumnsDto {
  @IsUUID()
  leftDatasetId!: string;

  @IsString()
  @MaxLength(32)
  leftColumnId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  leftDateColumnId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  leftExpectedRevision?: number;

  @IsUUID()
  rightDatasetId!: string;

  @IsString()
  @MaxLength(32)
  rightColumnId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  rightDateColumnId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rightExpectedRevision?: number;
}

export class ApplyDatasetTemplateDto {
  @IsUUID()
  templateId!: string;
}

export class ReplacementTargetDto {
  @IsUUID()
  targetDatasetId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class DatasetRowsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize = 50;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  dateColumnId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRevision?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  chartColumnId?: string;
}

export class DatasetPageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize = 50;
}

export class CreateDatasetTemplateDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(64)
  headerFingerprint!: string;

  @IsObject()
  rules!: Record<string, unknown>;
}
