import { IsDateString, IsIn, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateTargetDto {
  @IsOptional() @IsNumber() @Min(0) targetValue?: number;
  @IsOptional()
  @IsIn(['HIGHER_IS_BETTER', 'LOWER_IS_BETTER'])
  comparisonRule?: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
}
