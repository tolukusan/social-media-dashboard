import { IsEmail, IsString, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsString() @MaxLength(320) @IsEmail() email!: string;
}
