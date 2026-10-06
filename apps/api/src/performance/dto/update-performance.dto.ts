import { IsDateString, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdatePerformanceDto {
  @IsOptional() @IsDateString() recordDate?: string;
  @IsOptional() @IsObject() values?: Record<string, number>;
  @IsOptional() @IsString() notes?: string;
}
