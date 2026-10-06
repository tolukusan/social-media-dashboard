import { IsString, Length, IsOptional, IsUUID } from 'class-validator';

export class CreatePlatformDto {
  @IsUUID() channelId!: string;
  @IsString() @Length(2, 50) code!: string;
  @IsString() @Length(2, 120) name!: string;
  @IsOptional() @IsString() @Length(0, 500) description?: string;
}
