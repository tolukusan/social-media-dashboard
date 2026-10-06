import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class DashboardQueryDto {
  @IsOptional()
  @IsIn(['CAMPAIGN', 'CHANNEL'])
  dimension?: 'CAMPAIGN' | 'CHANNEL';

  @IsOptional()
  @IsString()
  dimensionIds?: string;

  @IsOptional()
  @IsIn(['PERIOD', 'LIFETIME'])
  comparisonMode?: 'PERIOD' | 'LIFETIME';

  @IsOptional()
  @IsIn(['CUSTOM', 'MONTH', 'QUARTER', 'YEAR'])
  @IsString()
  comparisonPeriod?: 'CUSTOM' | 'MONTH' | 'QUARTER' | 'YEAR';

  @IsOptional()
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CAMPAIGN'])
  targetPeriod?:
    'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CAMPAIGN';

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsUUID()
  channelId?: string;

  @IsOptional()
  @IsUUID()
  platformId?: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  metricCode?: string;
}
