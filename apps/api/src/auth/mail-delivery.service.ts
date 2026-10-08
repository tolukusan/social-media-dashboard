import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

export type RecoveryMail = { to: string; url: string; expiresMinutes: number };

@Injectable()
export class MailDeliveryService {
  private readonly logger = new Logger(MailDeliveryService.name);
  private pending = 0;
  private readonly maxPending = 50;
  private readonly captured: RecoveryMail[] = [];
  private captureEnabled = process.env.NODE_ENV === 'test';

  enableCaptureForVerification() {
    this.captureEnabled = true;
  }

  enqueue(message: RecoveryMail, onFailure: () => Promise<void>) {
    if (this.pending >= this.maxPending) {
      void onFailure().catch(() => undefined);
      return false;
    }
    this.pending += 1;
    void this.deliver(message)
      .catch(async () => {
        try {
          await onFailure();
        } catch {
          // Delivery errors and provider details stay out of logs and responses.
        }
      })
      .finally(() => {
        this.pending -= 1;
      });
    return true;
  }

  capturedForVerification() {
    return this.captured;
  }

  private async deliver(message: RecoveryMail) {
    if (this.captureEnabled) {
      this.captured.push(message);
      return;
    }
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(
        `Development password recovery for ${message.to}: ${message.url} (expires in ${message.expiresMinutes} minutes)`,
      );
      return;
    }
    const host = process.env.SMTP_HOST;
    const from = process.env.SMTP_FROM;
    if (!host || !from) throw new Error('MAIL_CONFIGURATION_UNAVAILABLE');
    const port = Number(process.env.SMTP_PORT ?? '587');
    const secure = process.env.SMTP_SECURE === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      ...(user && pass ? { auth: { user, pass } } : {}),
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      requireTLS: Boolean(user && pass && !secure),
      tls: { rejectUnauthorized: true },
    });
    try {
      await transport.sendMail({
        from,
        to: message.to,
        subject: 'Reset your Marketwise password',
        text: `Use this link to reset your password. It expires in ${message.expiresMinutes} minutes:\n\n${message.url}\n\nIf you did not request this, you can ignore this email.`,
      });
    } finally {
      transport.close();
    }
  }
}
