import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangeOwnPasswordDto {
  @IsString() @MinLength(10) @MaxLength(128) currentPassword!: string;
  @IsString() @MinLength(10) @MaxLength(128) newPassword!: string;
}
