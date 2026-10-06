import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import type { Response } from 'express';
import { PrismaService } from '../database/prisma.service.js';
import type { AuthenticatedUser } from '../common/auth.types.js';
import type { LoginDto } from './dto/login.dto.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';

const COOKIE = process.env.SESSION_COOKIE_NAME ?? 'smd_session';

@Injectable()
export class AuthService {
  private readonly loginAttempts = new Map<
    string,
    { count: number; windowStarted: number }
  >();
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private publicUser(user: AuthenticatedUser): AuthenticatedUser {
    const { passwordHash: _passwordHash, ...safe } =
      user as AuthenticatedUser & {
        passwordHash?: string;
      };
    return safe;
  }
  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async login(dto: LoginDto, response: Response) {
    const email = dto.email.trim().toLowerCase();
    const nowMs = Date.now();
    const attempts = this.loginAttempts.get(email);
    if (
      attempts &&
      nowMs - attempts.windowStarted < 15 * 60 * 1000 &&
      attempts.count >= 10
    )
      throw new UnauthorizedException({
        code: 'LOGIN_RATE_LIMITED',
        message: 'Too many login attempts. Try again later.',
      });
    if (!attempts || nowMs - attempts.windowStarted >= 15 * 60 * 1000)
      this.loginAttempts.set(email, { count: 1, windowStarted: nowMs });
    else attempts.count += 1;
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
    if (
      !user ||
      !user.active ||
      !(await argon2.verify(user.passwordHash, dto.password))
    )
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    this.loginAttempts.delete(email);
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.$transaction([
      this.prisma.session.create({
        data: { userId: user.id, tokenHash: this.hashToken(token), expiresAt },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: now },
      }),
    ]);
    response.cookie(COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }

  async logout(token: string | undefined, response: Response) {
    if (token)
      await this.prisma.session.updateMany({
        where: { tokenHash: this.hashToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    response.clearCookie(COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return { success: true };
  }

  async me(user: AuthenticatedUser) {
    return this.publicUser(user);
  }
  updateOwnProfile(userId: string, dto: UpdateProfileDto) {
    const name = dto.name.trim();
    if (name.length < 2)
      throw new BadRequestException({
        code: 'INVALID_NAME',
        message: 'Name must contain at least two characters',
      });
    return this.prisma.user.update({
      where: { id: userId },
      data: { name },
      include: { role: true },
      omit: { passwordHash: true },
    });
  }
  static cookieName() {
    return COOKIE;
  }
}
