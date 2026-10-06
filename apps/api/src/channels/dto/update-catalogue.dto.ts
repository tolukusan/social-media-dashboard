import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class UpdateCatalogueDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsString() @Length(2, 50) code?: string;
  @IsOptional() @IsString() @Length(0, 500) description?: string;
  @IsOptional() @IsUUID() channelId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
