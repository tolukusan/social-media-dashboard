import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AccessService } from './access.service.js';
import {
  RegistrationDto,
  AcceptInvitationDto,
  InviteUserDto,
  ReviewRequestDto,
} from './access.dto.js';
import { Roles } from '../common/roles.decorator.js';
import { CurrentUser } from '../common/auth.decorator.js';
import type { AuthenticatedUser } from '../common/auth.types.js';
@Controller('auth')
export class PublicAccessController {
  constructor(@Inject(AccessService) private readonly access: AccessService) {}
  @Post('register')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  register(@Body() dto: RegistrationDto, @Req() req: Request) {
    return this.access.register(dto, req.ip ?? 'unknown');
  }
  @Post('accept-invitation') @Header('Cache-Control', 'no-store') accept(
    @Body() dto: AcceptInvitationDto,
    @Req() req: Request,
  ) {
    return this.access.accept(dto, req.ip ?? 'unknown');
  }
}
@Controller('access')
@Roles('ADMIN')
export class AccessController {
  constructor(@Inject(AccessService) private readonly access: AccessService) {}
  @Get('requests') requests() {
    return this.access.requests();
  }
  @Post('requests/:id/review') review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.access.review(id, dto, user.id);
  }
  @Get('invitations') invitations() {
    return this.access.invitations();
  }
  @Post('invitations') @Header('Cache-Control', 'no-store') invite(
    @Body() dto: InviteUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.access.invite(dto, user.id);
  }
  @Post('invitations/:id/revoke') revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.access.revoke(id, user.id);
  }
}
