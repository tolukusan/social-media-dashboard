import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  Get,
  Inject,
  Patch,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { CurrentUser } from '../common/auth.decorator.js';
import type { AuthenticatedUser } from '../common/auth.types.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
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
