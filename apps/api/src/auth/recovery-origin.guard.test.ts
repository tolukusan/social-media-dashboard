import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { RecoveryOriginGuard } from './recovery-origin.guard.js';

function context(method: string, origin?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        path: '/api/v1/example',
        headers: origin ? { origin } : {},
      }),
    }),
  } as never;
}

describe('trusted Origin guard', () => {
  const configured = process.env.APP_ORIGIN ?? 'http://localhost:3000';

  it('allows safe methods without Origin', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS'])
      assert.equal(
        new RecoveryOriginGuard().canActivate(context(method)),
        true,
      );
  });

  it('requires the configured Origin for every unsafe method', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.throws(
        () => new RecoveryOriginGuard().canActivate(context(method)),
        ForbiddenException,
      );
      assert.throws(
        () =>
          new RecoveryOriginGuard().canActivate(
            context(method, 'https://attacker.invalid'),
          ),
        ForbiddenException,
      );
      assert.equal(
        new RecoveryOriginGuard().canActivate(context(method, configured)),
        true,
      );
    }
  });
});
