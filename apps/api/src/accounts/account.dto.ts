import { IsDateString, IsIn } from 'class-validator';
import { connectedAccountProviders } from './account-contract.js';

export class StartOAuthDto {
  @IsIn(connectedAccountProviders)
  provider!: (typeof connectedAccountProviders)[number];
}

export class AccountDateRangeDto {
  @IsDateString({ strict: true }) from!: string;
  @IsDateString({ strict: true }) to!: string;
}
