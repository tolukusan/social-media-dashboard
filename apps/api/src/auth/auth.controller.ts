import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  Get,
  Inject,
  Patch,
  Header,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { CurrentUser } from '../common/auth.decorator.js';
import type { AuthenticatedUser } from '../common/auth.types.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { RecoverPasswordDto } from './dto/recover-password.dto.js';
import { PasswordRecoveryService } from './password-recovery.service.js';
import { ChangeOwnPasswordDto } from './dto/change-own-password.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PasswordRecoveryService)
    private readonly recovery: PasswordRecoveryService,
  ) {}
  @Get('csrf') csrf(@Res({ passthrough: true }) response: Response) {
    const csrfToken = randomBytes(24).toString('base64url');
    response.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return { csrfToken };
  }
  @Post('login') login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.login(dto, response);
  }
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @Header('Cache-Control', 'no-store')
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() request: Request) {
    return this.recovery.request(dto, request);
  }
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  resetPassword(
    @Body() dto: RecoverPasswordDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.recovery.reset(dto, request, response);
  }
  @Patch('password') changeOwnPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangeOwnPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.changeOwnPassword(user.id, dto, response);
  }
  @Post('logout') logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = request.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${AuthService.cookieName()}=`))
      ?.split('=')
      .slice(1)
      .join('=');
    return this.auth.logout(token, response);
  }
  @Get('me') me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user);
  }
  @Patch('me') updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.auth.updateOwnProfile(user.id, dto);
  }
}
