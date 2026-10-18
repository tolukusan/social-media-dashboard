import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { PrismaService } from '../database/prisma.service.js';
import type { AuthenticatedUser } from '../common/auth.types.js';
import { AuthService } from './auth.service.js';

function readCookie(request: Request, name: string) {
  return request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    if (
      (request.method === 'GET' && request.path === '/api/v1/health') ||
      (request.method === 'POST' && request.path === '/api/v1/auth/login') ||
      (request.method === 'GET' && request.path === '/api/v1/auth/csrf') ||
      (request.method === 'GET' &&
        request.path === '/api/v1/accounts/oauth/callback') ||
      (request.method === 'GET' &&
        /^\/api\/v1\/integrations\/oauth\/(meta|linkedin|zoho|google)\/callback$/.test(
          request.path,
        )) ||
      (request.method === 'POST' &&
        request.path === '/api/v1/auth/forgot-password') ||
      (request.method === 'POST' &&
        request.path === '/api/v1/auth/reset-password')
    )
      return true;
    if (request.method === 'POST' && request.path === '/api/v1/auth/logout')
      return true;
    const token = readCookie(request, AuthService.cookieName());
    if (!token)
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
      });
    const session = await this.prisma.session.findFirst({
      where: {
        tokenHash: createHash('sha256').update(token).digest('hex'),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            roleId: true,
            name: true,
            email: true,
            active: true,
            lastLoginAt: true,
            deactivatedAt: true,
            createdAt: true,
            updatedAt: true,
            role: true,
          },
        },
      },
    });
    if (!session || !session.user.active)
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
      });
    request.user = session.user;
    void this.prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });
    return true;
  }
}
