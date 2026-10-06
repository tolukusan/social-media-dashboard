import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString() @MinLength(10) password!: string;
}
