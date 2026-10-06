import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  IsIn,
  Length,
} from 'class-validator';

export class MapImportDto {
  @IsObject() mapping!: Record<string, string>;
  @IsOptional() @IsString() sourcePlatform?: string;
  @IsOptional() @IsString() @Length(2, 180) displayName?: string;
  @IsOptional() @IsUUID() campaignId?: string;
  @IsOptional() @IsUUID() platformId?: string;
  @IsOptional() @IsString() selectedSheet?: string;
  @IsOptional() @IsObject() campaignMappings?: Record<string, string>;
  @IsOptional() @IsObject() columnDisplayNames?: Record<string, string>;
  @IsOptional() @IsIn(['CREATE', 'APPEND', 'MERGE']) datasetAction?:
    'CREATE' | 'APPEND' | 'MERGE';
}
