import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class RecoveryOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method))
      return true;
    const configured = process.env.APP_ORIGIN ?? 'http://localhost:3000';
    let expected: string;
    try {
      expected = new URL(configured).origin;
    } catch {
      throw new ForbiddenException({
        code: 'ORIGIN_INVALID',
        message: 'Request origin is not allowed.',
      });
    }
    if (
      process.env.NODE_ENV === 'production' &&
      !expected.startsWith('https://')
    )
      throw new ForbiddenException({
        code: 'ORIGIN_INVALID',
        message: 'Request origin is not allowed.',
      });
    if (request.headers.origin !== expected)
      throw new ForbiddenException({
        code: 'ORIGIN_NOT_ALLOWED',
        message: 'Request origin is not allowed.',
      });
    return true;
  }
}
