import { IsString, MaxLength, MinLength } from 'class-validator';

export class RecoverPasswordDto {
  @IsString() @MinLength(40) @MaxLength(64) token!: string;
  @IsString() @MinLength(10) @MaxLength(128) password!: string;
}
