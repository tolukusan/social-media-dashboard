import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
export class RegistrationDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @Length(2, 120) name!: string;
  @IsString() @MinLength(10) @MaxLength(128) password!: string;
}
export class AcceptInvitationDto extends RegistrationDto {
  @IsString() @Length(40, 100) token!: string;
}
export class ReviewRequestDto {
  @IsIn(['APPROVED', 'REJECTED']) decision!: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsUUID() roleId?: string;
}
export class InviteUserDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsUUID() roleId!: string;
}
