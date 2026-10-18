import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type {
  RegistrationDto,
  AcceptInvitationDto,
  InviteUserDto,
  ReviewRequestDto,
} from './access.dto.js';
const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
const acknowledgement = {
  message:
    'If this request is eligible, it is pending Administrator approval. You can sign in after approval.',
};
const requestSelect = {
  id: true,
  email: true,
  name: true,
  status: true,
  createdAt: true,
  reviewedAt: true,
} as const;
const invitationSelect = {
  id: true,
  email: true,
  roleId: true,
  expiresAt: true,
  usedAt: true,
  revokedAt: true,
  createdAt: true,
} as const;
@Injectable()
export class AccessService {
  private readonly attempts = new Map<
    string,
    { count: number; expires: number }
  >();
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private limit(ip: string, email: string) {
    const now = Date.now();
    for (const [key, value] of this.attempts)
      if (value.expires <= now) this.attempts.delete(key);
    if (this.attempts.size > 10000)
      throw new HttpException('Please try again later.', 429);
    for (const key of [`ip:${ip}`, `email:${email}`]) {
      const attempt = this.attempts.get(key) ?? {
        count: 0,
        expires: now + 15 * 60_000,
      };
      attempt.count++;
      this.attempts.set(key, attempt);
      if (attempt.count > 10)
        throw new HttpException('Please try again later.', 429);
    }
  }
  private async lock(tx: Prisma.TransactionClient, email: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`access:${email}`})::bigint)`;
  }
  private async admin(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM social_media_dashboard."User" WHERE id = ${id}::uuid FOR SHARE`;
    const actor = await tx.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!actor?.active || !actor.role.active || actor.role.code !== 'ADMIN')
      throw new ForbiddenException('An active Administrator is required.');
  }
  private async role(tx: Prisma.TransactionClient, id?: string) {
    const role = id ? await tx.role.findUnique({ where: { id } }) : null;
    if (
      !role?.active ||
      !['ADMIN', 'MARKETING_OFFICER', 'MANAGEMENT'].includes(role.code)
    )
      throw new BadRequestException('Choose an existing active role.');
    return role;
  }
  async register(dto: RegistrationDto, ip: string) {
    const email = dto.email.trim().toLowerCase();
    this.limit(ip, email);
    const name = dto.name.trim();
    if (name.length < 2) throw new BadRequestException('Enter your name.');
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, email);
      if (
        (await tx.user.findUnique({ where: { email } })) ||
        (await tx.registrationRequest.findUnique({ where: { email } }))
      )
        return;
      const request = await tx.registrationRequest.create({
        data: { email, name, passwordHash },
      });
      await tx.auditLog.create({
        data: {
          action: 'REGISTRATION_REQUESTED',
          entityType: 'RegistrationRequest',
          entityId: request.id,
        },
      });
    });
    return acknowledgement;
  }
  requests() {
    return this.prisma.registrationRequest.findMany({
      select: requestSelect,
      orderBy: { createdAt: 'desc' },
    });
  }
  invitations() {
    return this.prisma.userInvitation.findMany({
      select: invitationSelect,
      orderBy: { createdAt: 'desc' },
    });
  }
  async review(id: string, dto: ReviewRequestDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const initial = await tx.registrationRequest.findUnique({
        where: { id },
      });
      if (!initial)
        throw new ConflictException('Access request is unavailable.');
      await this.lock(tx, initial.email);
      await this.admin(tx, actorId);
      const request = await tx.registrationRequest.findUniqueOrThrow({
        where: { id },
      });
      if (request.status !== 'PENDING' || !request.passwordHash)
        throw new ConflictException('This request has already been resolved.');
      let userId: string | null = null;
      if (dto.decision === 'APPROVED') {
        const role = await this.role(tx, dto.roleId);
        if (await tx.user.findUnique({ where: { email: request.email } }))
          throw new ConflictException(
            'An account already exists. Reject this request and use account management.',
          );
        const user = await tx.user.create({
          data: {
            name: request.name,
            email: request.email,
            passwordHash: request.passwordHash,
            roleId: role.id,
          },
        });
        userId = user.id;
      }
      await tx.registrationRequest.update({
        where: { id },
        data: {
          status: dto.decision,
          reviewedAt: new Date(),
          reviewedByUserId: actorId,
          approvedUserId: userId,
          passwordHash: null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: `REGISTRATION_${dto.decision}`,
          entityType: 'RegistrationRequest',
          entityId: id,
          metadata: {
            userId,
            roleId: dto.decision === 'APPROVED' ? dto.roleId : null,
          },
        },
      });
      return { resolved: true };
    });
  }
  async invite(dto: InviteUserDto, actorId: string) {
    const email = dto.email.trim().toLowerCase();
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, email);
      await this.admin(tx, actorId);
      const role = await this.role(tx, dto.roleId);
      const pending = await tx.registrationRequest.findUnique({
        where: { email },
      });
      if (
        (await tx.user.findUnique({ where: { email } })) ||
        pending?.status === 'PENDING'
      )
        throw new ConflictException(
          'Resolve any pending request or existing account through account management first.',
        );
      await tx.userInvitation.updateMany({
        where: { email, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const token = randomBytes(32).toString('base64url');
      const invitation = await tx.userInvitation.create({
        data: {
          email,
          roleId: role.id,
          invitedByUserId: actorId,
          tokenHash: hash(token),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
        },
        select: invitationSelect,
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: 'USER_INVITED',
          entityType: 'UserInvitation',
          entityId: invitation.id,
          metadata: { roleId: role.id },
        },
      });
      const url = new URL(
        '/accept-invitation',
        process.env.APP_ORIGIN ?? 'http://localhost:3000',
      );
      url.hash = new URLSearchParams({ token }).toString();
      return { ...invitation, invitationUrl: url.toString() };
    });
  }
  async revoke(id: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.admin(tx, actorId);
      await tx.userInvitation.updateMany({
        where: { id, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: 'INVITATION_REVOKED',
          entityType: 'UserInvitation',
          entityId: id,
        },
      });
      return { revoked: true };
    });
  }
  async accept(dto: AcceptInvitationDto, ip: string) {
    const email = dto.email.trim().toLowerCase();
    this.limit(ip, email);
    const name = dto.name.trim();
    if (name.length < 2) throw new BadRequestException('Enter your name.');
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, email);
      const invitation = await tx.userInvitation.findUnique({
        where: { tokenHash: hash(dto.token) },
      });
      if (
        !invitation ||
        invitation.email !== email ||
        invitation.usedAt ||
        invitation.revokedAt ||
        invitation.expiresAt <= new Date()
      )
        throw new ConflictException('Invitation is invalid or expired.');
      await this.admin(tx, invitation.invitedByUserId);
      await this.role(tx, invitation.roleId);
      const pending = await tx.registrationRequest.findUnique({
        where: { email },
      });
      if (
        (await tx.user.findUnique({ where: { email } })) ||
        pending?.status === 'PENDING'
      )
        throw new ConflictException(
          'Invitation cannot be accepted. Contact an Administrator or use sign in and recovery.',
        );
      const consumed = await tx.userInvitation.updateMany({
        where: {
          id: invitation.id,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (!consumed.count)
        throw new ConflictException('Invitation is invalid or expired.');
      const user = await tx.user.create({
        data: { name, email, passwordHash, roleId: invitation.roleId },
      });
      await tx.auditLog.create({
        data: {
          action: 'INVITATION_ACCEPTED',
          entityType: 'UserInvitation',
          entityId: invitation.id,
          metadata: { userId: user.id },
        },
      });
      return { message: 'Your account is ready. Sign in to continue.' };
    });
  }
}
