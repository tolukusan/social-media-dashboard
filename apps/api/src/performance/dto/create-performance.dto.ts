import {
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreatePerformanceDto {
  @IsUUID() campaignPlatformId!: string;
  @IsDateString() recordDate!: string;
  @IsObject() values!: Record<string, number>;
  @IsOptional() @IsString() notes?: string;
}
