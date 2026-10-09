import {
  IsBoolean,
  IsIn,
  ValidateIf,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { providers, regions } from './integration-contract.js';
import type { Provider } from './integration-contract.js';

export class CreateConnectionDto {
  @IsIn(providers) provider!: Provider;
  @IsUUID() platformId!: string;
  @IsString() @Length(1, 120) displayName!: string;
  @IsString() @Matches(/^[A-Za-z0-9_-]{1,160}$/) externalAccountId!: string;
  @IsString()
  @Matches(/^INTEGRATION_[A-Z0-9_]+_ACCESS_TOKEN$/)
  @Length(1, 100)
  credentialReference!: string;
  @IsString() @Length(1, 100) sourceTimezone!: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;
  @ValidateIf((_, value) => value !== undefined) @IsIn(regions) region?: string;
}
export class UpdateConnectionDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/^INTEGRATION_[A-Z0-9_]+_ACCESS_TOKEN$/)
  @Length(1, 100)
  credentialReference?: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Length(1, 100)
  sourceTimezone?: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  autoSync?: boolean;
  @ValidateIf((_, value) => value !== undefined) @IsBoolean() active?: boolean;
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Length(1, 120)
  displayName?: string;
}
export class CreateMappingDto {
  @IsUUID() campaignPlatformId!: string;
  @IsString() @Matches(/^[A-Za-z0-9_-]{1,160}$/) externalCampaignId!: string;
}
export class SyncConnectionDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
}
