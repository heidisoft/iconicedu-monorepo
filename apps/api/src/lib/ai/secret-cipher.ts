import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM envelope encryption for org-supplied secrets (currently: each
// org's AI provider API key) so they can live in Postgres without ever being
// readable from the database itself. The master key comes from the
// AI_PROVIDER_KEY_ENCRYPTION_KEY env var (base64, 32 raw bytes) and must
// match apps/web/lib/ai/secret-cipher.ts, which encrypts on save — this file
// only ever decrypts. Kept as a small standalone module (not in
// @iconicedu/utils) so `node:crypto` never ends up in a browser bundle via
// ui-web, which also depends on that shared package.

const ALGORITHM = 'aes-256-gcm';
const FORMAT_VERSION = 'v1';

function loadKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) {
    throw new Error(
      'Secret cipher key must decode to exactly 32 bytes (base64-encoded AES-256 key)',
    );
  }
  return key;
}

export function encryptSecret(plaintext: string, base64Key: string): string {
  const key = loadKey(base64Key);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    FORMAT_VERSION,
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join('.');
}

/** Throws if the ciphertext is malformed, the key is wrong, or the auth tag doesn't match (tampering). */
export function decryptSecret(ciphertext: string, base64Key: string): string {
  const parts = ciphertext.split('.');
  const [version, ivB64, authTagB64, dataB64] = parts;
  if (
    version !== FORMAT_VERSION ||
    !ivB64 ||
    !authTagB64 ||
    !dataB64 ||
    parts.length !== 4
  ) {
    throw new Error('Malformed encrypted secret');
  }
  const key = loadKey(base64Key);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
