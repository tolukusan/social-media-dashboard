import { IsDateString, IsIn, IsOptional } from 'class-validator';

export class AccountAnalyticsQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsIn(['ACCOUNT', 'CONTENT'])
  scope?: 'ACCOUNT' | 'CONTENT';
}
