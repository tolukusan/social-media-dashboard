import { ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function encryptionKey() {
  const configured = process.env.INTEGRATION_OAUTH_ENCRYPTION_KEY?.trim();
  if (!configured)
    throw new ServiceUnavailableException({
      code: 'OAUTH_ENCRYPTION_NOT_CONFIGURED',
      message: 'OAuth credential storage is not configured on this server.',
    });
  const key = Buffer.from(configured, 'base64');
  if (key.length !== 32 || key.toString('base64') !== configured)
    throw new ServiceUnavailableException({
      code: 'OAUTH_ENCRYPTION_NOT_CONFIGURED',
      message: 'OAuth credential storage is not configured on this server.',
    });
  return key;
}

export function encryptSecret(value: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), nonce);
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  return `v1.${nonce.toString('base64url')}.${cipher
    .getAuthTag()
    .toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function decryptSecret(value: string) {
  const [version, noncePart, tagPart, ciphertextPart, ...extra] =
    value.split('.');
  if (
    version !== 'v1' ||
    !noncePart ||
    !tagPart ||
    !ciphertextPart ||
    extra.length
  )
    throw new ServiceUnavailableException({
      code: 'OAUTH_CREDENTIAL_UNREADABLE',
      message: 'The stored provider credential cannot be used. Reconnect it.',
    });
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      Buffer.from(noncePart, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new ServiceUnavailableException({
      code: 'OAUTH_CREDENTIAL_UNREADABLE',
      message: 'The stored provider credential cannot be used. Reconnect it.',
    });
  }
}
