import { Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MailDeliveryService } from './mail-delivery.service.js';

const message = {
  to: 'recovery@example.invalid',
  url: 'http://localhost:3000/reset-password#token=verification-placeholder',
  expiresMinutes: 30,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('password recovery delivery modes', () => {
  it('logs a usable recovery message only in explicit development mode without SMTP', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SMTP_HOST', '');
    vi.stubEnv('SMTP_FROM', '');
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const transport = vi.spyOn(nodemailer, 'createTransport');
    const failed = vi.fn(async () => {});
    const mail = new MailDeliveryService();
    expect(mail.enqueue(message, failed)).toBe(true);
    await vi.waitFor(() => expect(log).toHaveBeenCalledOnce());
    expect(log.mock.calls[0][0]).toContain(message.url);
    expect(log.mock.calls[0][0]).toContain('30 minutes');
    expect(transport).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
  });

  it.each(['production', 'staging', ''])(
    'does not log recovery links in %s mode even when SMTP is unavailable',
    async (mode) => {
      vi.stubEnv('NODE_ENV', mode);
      vi.stubEnv('SMTP_HOST', '');
      vi.stubEnv('SMTP_FROM', '');
      const log = vi
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => {});
      const failed = vi.fn(async () => {});
      new MailDeliveryService().enqueue(message, failed);
      await vi.waitFor(() => expect(failed).toHaveBeenCalledOnce());
      expect(log).not.toHaveBeenCalled();
    },
  );

  it('keeps test capture silent', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const mail = new MailDeliveryService();
    mail.enqueue(
      message,
      vi.fn(async () => {}),
    );
    await vi.waitFor(() =>
      expect(mail.capturedForVerification()).toEqual([message]),
    );
    expect(log).not.toHaveBeenCalled();
  });

  it('uses SMTP without logging the message in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SMTP_HOST', 'smtp.example.invalid');
    vi.stubEnv('SMTP_FROM', 'sender@example.invalid');
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const sendMail = vi.fn(async () => ({}));
    const close = vi.fn();
    vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail,
      close,
    } as unknown as ReturnType<typeof nodemailer.createTransport>);
    const failed = vi.fn(async () => {});
    new MailDeliveryService().enqueue(message, failed);
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(sendMail).toHaveBeenCalledOnce();
    expect(failed).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});
