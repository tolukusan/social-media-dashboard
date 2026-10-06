import 'reflect-metadata';
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard.js';

function context(role: string) {
  const handler = () => undefined;
  Reflect.defineMetadata('roles', ['ADMIN'], handler);
  return {
    getHandler: () => handler,
    getClass: () => class Test {},
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: 'user', role: { code: role } } }),
    }),
  } as never;
}

describe('RolesGuard authorization matrix', () => {
  it('allows Administrator on an Administrator-only action', () => {
    assert.equal(new RolesGuard().canActivate(context('ADMIN')), true);
  });

  it('denies Marketing Officer and Management on an Administrator-only action', () => {
    for (const role of ['MARKETING_OFFICER', 'MANAGEMENT']) {
      assert.throws(
        () => new RolesGuard().canActivate(context(role)),
        ForbiddenException,
      );
    }
  });
});
