import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../common/roles.decorator.js';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { CurrentUser } from '../common/auth.decorator.js';
import type { AuthenticatedUser } from '../common/auth.types.js';

@Controller('users')
@Roles('ADMIN')
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}
  @Get('roles') roles() {
    return this.users.roles();
  }
  @Get() list() {
    return this.users.list();
  }
  @Post() create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.create(dto, actor.id);
  }
  @Patch(':id') update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.update(id, dto, actor.id);
  }
  @Delete(':id') deactivate(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.deactivate(id, actor.id);
  }
  @Patch(':id/password') resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.resetPassword(id, dto, actor.id);
  }
  @Patch(':id/reactivate') reactivate(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.reactivate(id, actor.id);
  }
}
