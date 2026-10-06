import { IsEmail, IsString, IsUUID, Length, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString() @Length(2, 120) name!: string;
  @IsEmail() email!: string;
  @IsUUID() roleId!: string;
  @IsString() @MinLength(10) password!: string;
}
