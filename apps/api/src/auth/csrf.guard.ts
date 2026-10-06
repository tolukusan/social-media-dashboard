import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

function readCookie(request: Request, name: string) {
  return request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (
      ['GET', 'HEAD', 'OPTIONS'].includes(request.method) ||
      request.path.endsWith('/auth/login')
    )
      return true;
    const cookie = readCookie(request, 'csrf_token');
    const header = request.headers['x-csrf-token'];
    if (!cookie || typeof header !== 'string' || cookie !== header)
      throw new ForbiddenException({
        code: 'CSRF_TOKEN_INVALID',
        message: 'A valid CSRF token is required',
      });
    return true;
  }
}
