import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

export class CampaignChannelSelectionDto {
  @IsUUID() channelId!: string;
  @IsArray() @IsUUID('4', { each: true }) platformIds!: string[];
}

export class CreateCampaignDto {
  @IsString() @Length(2, 180) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() objective?: string;
  @IsOptional() @IsString() targetAudience?: string;
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional()
  @IsIn(['PLANNED', 'ACTIVE', 'COMPLETED', 'SUSPENDED', 'CANCELLED'])
  status?: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'SUSPENDED' | 'CANCELLED';
  @IsOptional() @IsNumber() @Min(0) budget?: number;
  @IsUUID() responsibleUserId!: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignChannelSelectionDto)
  channels!: CampaignChannelSelectionDto[];
}
