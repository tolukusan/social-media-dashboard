import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import type { Request, Response } from 'express';
import { PrismaService } from '../database/prisma.service.js';
import { UserSecurityLockService } from './user-security-lock.service.js';
import { MailDeliveryService } from './mail-delivery.service.js';
import type { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import type { RecoverPasswordDto } from './dto/recover-password.dto.js';
import { AuthService } from './auth.service.js';

const TOKEN_TTL_MS = 30 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const EMAIL_LIMIT = 3;
const REQUEST_IP_LIMIT = 20;
const RESET_IP_LIMIT = 20;
const GENERIC_ACK =
  'If an active account uses this email, we will send a password reset link.';

@Injectable()
export class PasswordRecoveryService {
  private readonly limits = new Map<
    string,
    { count: number; expiresAt: number }
  >();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UserSecurityLockService)
    private readonly locks: UserSecurityLockService,
    @Inject(MailDeliveryService) private readonly mail: MailDeliveryService,
  ) {}

  async request(dto: ForgotPasswordDto, request: Request) {
    const configuredOrigin = this.validatedOrigin();
    const email = dto.email.trim().toLowerCase();
    const ip = request.ip || 'unknown';
    const emailKey = this.key(`email:${email}`);
    const ipKey = this.key(`request-ip:${ip}`);
    this.enforceLimit(emailKey, EMAIL_LIMIT);
    this.enforceLimit(ipKey, REQUEST_IP_LIMIT);
    const startedAt = Date.now();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (user) {
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = this.hash(rawToken);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);
      const eligible = await this.prisma.$transaction(async (tx) => {
        await this.locks.lock(tx, user.id);
        const current = await tx.user.findUnique({ where: { id: user.id } });
        if (!current?.active || current.email !== email) return null;
        await this.locks.invalidateRecoveryTokens(tx, current.id, now);
        await tx.passwordRecoveryToken.create({
          data: {
            userId: current.id,
            tokenHash,
            emailAtIssue: email,
            createdAt: now,
            expiresAt,
          },
        });
        return current.email;
      });
      if (eligible) {
        const url = this.resetUrl(rawToken, configuredOrigin);
        this.mail.enqueue({ to: eligible, url, expiresMinutes: 30 }, () =>
          this.revokeFailedDelivery(user.id, tokenHash),
        );
      }
    }
    const minimumDuration = 120;
    const remaining = minimumDuration - (Date.now() - startedAt);
    if (remaining > 0)
      await new Promise((resolve) => setTimeout(resolve, remaining));
    return { message: GENERIC_ACK };
  }

  async reset(dto: RecoverPasswordDto, request: Request, response: Response) {
    this.enforceLimit(
      this.key(`reset-ip:${request.ip || 'unknown'}`),
      RESET_IP_LIMIT,
    );
    const bytes = Buffer.from(dto.token, 'base64url');
    if (bytes.length !== 32 || bytes.toString('base64url') !== dto.token)
      this.invalidLink();
    const tokenHash = this.hash(dto.token);
    const candidate = await this.prisma.passwordRecoveryToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    const now = new Date();
    if (!candidate || !this.usable(candidate, now)) this.invalidLink();
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    const committed = await this.prisma.$transaction(async (tx) => {
      await this.locks.lock(tx, candidate.userId);
      const current = await tx.passwordRecoveryToken.findUnique({
        where: { id: candidate.id },
        include: { user: true },
      });
      const at = new Date();
      if (!current || !this.usable(current, at)) return false;
      const claimed = await tx.passwordRecoveryToken.updateMany({
        where: {
          id: current.id,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: at },
        },
        data: { usedAt: at },
      });
      if (claimed.count !== 1) return false;
      await tx.user.update({
        where: { id: current.userId },
        data: { passwordHash },
      });
      await tx.session.updateMany({
        where: { userId: current.userId, revokedAt: null },
        data: { revokedAt: at },
      });
      await this.locks.invalidateRecoveryTokens(tx, current.userId, at);
      await tx.auditLog.create({
        data: {
          actorUserId: null,
          action: 'PASSWORD_RECOVERY_COMPLETED',
          entityType: 'User',
          entityId: current.userId,
          metadata: { method: 'EMAIL_TOKEN' },
        },
      });
      return true;
    });
    if (!committed) this.invalidLink();
    response.clearCookie(AuthService.cookieName(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return { success: true };
  }

  private usable(
    token: {
      expiresAt: Date;
      usedAt: Date | null;
      revokedAt: Date | null;
      emailAtIssue: string;
      user: { active: boolean; email: string };
    },
    now: Date,
  ) {
    return (
      token.user.active &&
      token.emailAtIssue === token.user.email &&
      token.expiresAt > now &&
      !token.usedAt &&
      !token.revokedAt
    );
  }

  private async revokeFailedDelivery(userId: string, tokenHash: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.locks.lock(tx, userId);
      const changed = await tx.passwordRecoveryToken.updateMany({
        where: { userId, tokenHash, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (changed.count)
        await tx.auditLog.create({
          data: {
            actorUserId: null,
            action: 'PASSWORD_RECOVERY_EMAIL_FAILED',
            entityType: 'User',
            entityId: userId,
            metadata: { code: 'RECOVERY_EMAIL_DELIVERY_FAILED' },
          },
        });
    });
  }

  private validatedOrigin() {
    const configured = process.env.APP_ORIGIN ?? 'http://localhost:3000';
    const origin = new URL(configured);
    if (
      origin.origin !== configured.replace(/\/$/, '') ||
      (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:')
    )
      throw new Error('APP_ORIGIN_INVALID');
    return origin;
  }

  private resetUrl(token: string, origin: URL) {
    const url = new URL('/reset-password', origin);
    url.hash = new URLSearchParams({ token }).toString();
    return url.toString();
  }

  private enforceLimit(key: string, limit: number) {
    const now = Date.now();
    for (const [entry, value] of this.limits)
      if (value.expiresAt <= now) this.limits.delete(entry);
    if (this.limits.size >= 10000 && !this.limits.has(key)) {
      const oldest = this.limits.keys().next().value;
      if (oldest) this.limits.delete(oldest);
    }
    const current = this.limits.get(key);
    if (!current || current.expiresAt <= now) {
      this.limits.set(key, { count: 1, expiresAt: now + WINDOW_MS });
      return;
    }
    if (current.count >= limit)
      throw new HttpException(
        {
          code: 'RECOVERY_RATE_LIMITED',
          message: 'Too many requests. Try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    current.count += 1;
  }

  private key(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
  private hash(token: string) {
    return this.key(token);
  }
  private invalidLink(): never {
    throw new BadRequestException({
      code: 'RECOVERY_LINK_INVALID',
      message:
        'This password reset link is invalid or has expired. Request a new link to continue.',
    });
  }
}
