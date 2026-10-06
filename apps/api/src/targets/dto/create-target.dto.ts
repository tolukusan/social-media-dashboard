import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateTargetDto {
  @IsUUID() kpiDefinitionId!: string;
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CAMPAIGN'])
  periodType!: string;
  @IsNumber() @Min(0) targetValue!: number;
  @IsIn(['GLOBAL', 'CHANNEL', 'PLATFORM', 'CAMPAIGN']) scopeType!: string;
  @IsOptional() @IsUUID() channelId?: string;
  @IsOptional() @IsUUID() platformId?: string;
  @IsOptional() @IsUUID() campaignId?: string;
  @IsIn(['HIGHER_IS_BETTER', 'LOWER_IS_BETTER']) comparisonRule!: string;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
}
