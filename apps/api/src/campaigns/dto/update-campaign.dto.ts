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
import { CampaignChannelSelectionDto } from './create-campaign.dto.js';

export class UpdateCampaignDto {
  @IsOptional() @IsString() @Length(2, 180) name?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() objective?: string | null;
  @IsOptional() @IsString() targetAudience?: string | null;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string | null;
  @IsOptional()
  @IsIn(['PLANNED', 'ACTIVE', 'COMPLETED', 'SUSPENDED', 'CANCELLED'])
  status?: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'SUSPENDED' | 'CANCELLED';
  @IsOptional() @IsNumber() @Min(0) budget?: number | null;
  @IsOptional() @IsUUID() responsibleUserId?: string;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignChannelSelectionDto)
  channels?: CampaignChannelSelectionDto[];
}
