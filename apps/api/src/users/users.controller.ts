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
  @Post() create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }
  @Delete(':id') deactivate(@Param('id') id: string) {
    return this.users.deactivate(id);
  }
  @Patch(':id/password') resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.users.resetPassword(id, dto);
  }
  @Patch(':id/reactivate') reactivate(@Param('id') id: string) {
    return this.users.reactivate(id);
  }
}
