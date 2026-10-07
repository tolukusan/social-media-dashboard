import {
  ConflictException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import argon2 from 'argon2';
import { PrismaService } from '../database/prisma.service.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { ResetPasswordDto } from './dto/reset-password.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import { UserSecurityLockService } from '../auth/user-security-lock.service.js';

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UserSecurityLockService)
    private readonly locks: UserSecurityLockService,
  ) {}
  roles() {
    return this.prisma.role.findMany({
      where: {
        active: true,
        code: { in: ['ADMIN', 'MARKETING_OFFICER', 'MANAGEMENT'] },
      },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    });
  }
  list() {
    return this.prisma.user.findMany({
      include: { role: true },
      orderBy: { name: 'asc' },
      omit: { passwordHash: true },
    });
  }
  async create(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const [existing, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { email } }),
      this.prisma.role.findUnique({ where: { id: dto.roleId } }),
    ]);
    if (existing)
      throw new ConflictException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'A user with that email already exists',
      });
    if (
      !role ||
      !role.active ||
      !['ADMIN', 'MARKETING_OFFICER', 'MANAGEMENT'].includes(role.code)
    )
      throw new ConflictException({
        code: 'INVALID_ROLE',
        message: 'The selected role is not available',
      });
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        roleId: dto.roleId,
        passwordHash: await argon2.hash(dto.password, {
          type: argon2.argon2id,
        }),
      },
      include: { role: true },
    });
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }
  async update(id: string, dto: UpdateUserDto) {
    if (
      dto.name === undefined &&
      dto.email === undefined &&
      dto.roleId === undefined
    )
      throw new BadRequestException({
        code: 'EMPTY_USER_UPDATE',
        message: 'Provide at least one user field to update',
      });

    const current = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (!current)
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });

    const currentEmail = current.email;
    const data: { name?: string; email?: string; roleId?: string } = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (name.length < 2)
        throw new BadRequestException({
          code: 'INVALID_NAME',
          message: 'Name must contain at least two characters',
        });
      data.name = name;
    }
    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== id)
        throw new ConflictException({
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'A user with that email already exists',
        });
      data.email = email;
    }
    if (dto.roleId !== undefined) {
      const role = await this.prisma.role.findUnique({
        where: { id: dto.roleId },
      });
      if (
        !role ||
        !role.active ||
        !['ADMIN', 'MARKETING_OFFICER', 'MANAGEMENT'].includes(role.code)
      )
        throw new ConflictException({
          code: 'INVALID_ROLE',
          message: 'The selected role is not available',
        });
      data.roleId = role.id;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.locks.lock(tx, id);
        const result = await tx.user.update({
          where: { id },
          data,
          include: { role: true },
          omit: { passwordHash: true },
        });
        if (data.email !== undefined && data.email !== currentEmail)
          await this.locks.invalidateRecoveryTokens(tx, id);
        return result;
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      )
        throw new ConflictException({
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'A user with that email already exists',
        });
      throw error;
    }
  }
  async deactivate(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user)
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await this.locks.lock(tx, id);
      await tx.user.update({
        where: { id },
        data: { active: false, deactivatedAt: now },
      });
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.locks.invalidateRecoveryTokens(tx, id, now);
    });
    return { success: true };
  }
  async resetPassword(id: string, dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user)
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    const now = new Date();
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    await this.prisma.$transaction(async (tx) => {
      await this.locks.lock(tx, id);
      await tx.user.update({ where: { id }, data: { passwordHash } });
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.locks.invalidateRecoveryTokens(tx, id, now);
    });
    return { success: true };
  }

  async reactivate(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user)
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    return this.prisma.$transaction(async (tx) => {
      await this.locks.lock(tx, id);
      return tx.user.update({
        where: { id },
        data: { active: true, deactivatedAt: null },
        include: { role: true },
        omit: { passwordHash: true },
      });
    });
  }
}
