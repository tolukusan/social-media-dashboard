import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class UserSecurityLockService {
  async lock(tx: Prisma.TransactionClient, userId: string) {
    await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT true AS locked
      FROM pg_advisory_xact_lock(
        hashtextextended('user-security:' || ${userId}, 0)
      )
    `;
  }

  invalidateRecoveryTokens(
    tx: Prisma.TransactionClient,
    userId: string,
    now = new Date(),
  ) {
    return tx.passwordRecoveryToken.updateMany({
      where: { userId, usedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}
