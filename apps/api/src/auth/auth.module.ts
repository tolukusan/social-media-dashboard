import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionGuard } from './session.guard.js';
import { RolesGuard } from '../common/roles.guard.js';
import { CsrfGuard } from './csrf.guard.js';
import { PasswordRecoveryService } from './password-recovery.service.js';
import { UserSecurityLockService } from './user-security-lock.service.js';
import { MailDeliveryService } from './mail-delivery.service.js';
import { RecoveryOriginGuard } from './recovery-origin.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordRecoveryService,
    UserSecurityLockService,
    MailDeliveryService,
    RecoveryOriginGuard,
    SessionGuard,
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: RecoveryOriginGuard },
  ],
  exports: [AuthService, PasswordRecoveryService, UserSecurityLockService],
})
export class AuthModule {}
