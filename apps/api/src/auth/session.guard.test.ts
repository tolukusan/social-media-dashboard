import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SessionGuard } from './session.guard.js';

function context(method: string, path: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, path, headers: {} }),
    }),
  } as unknown as ExecutionContext;
}

describe('SessionGuard OAuth callback boundary', () => {
  it('allows the provider callback without a local session cookie', async () => {
    const prisma = { session: { findFirst: vi.fn() } };
    const guard = new SessionGuard(prisma as never);

    await expect(
      guard.canActivate(
        context('GET', '/api/v1/integrations/oauth/google/callback'),
      ),
    ).resolves.toBe(true);
    expect(prisma.session.findFirst).not.toHaveBeenCalled();
  });

  it('does not make other integration routes public', async () => {
    const prisma = { session: { findFirst: vi.fn() } };
    const guard = new SessionGuard(prisma as never);

    await expect(
      guard.canActivate(
        context('GET', '/api/v1/integrations/oauth/google/start'),
      ),
    ).rejects.toMatchObject({
      response: { code: 'UNAUTHENTICATED' },
    });
    expect(prisma.session.findFirst).not.toHaveBeenCalled();
  });
});
