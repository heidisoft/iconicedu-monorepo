import { createCipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM envelope encryption for org-supplied secrets (currently: each
// org's AI provider API key) so they can live in Postgres without ever being
// readable from the database itself. The master key comes from the
// AI_PROVIDER_KEY_ENCRYPTION_KEY env var (base64, 32 raw bytes) and must
// match apps/api/src/lib/ai/secret-cipher.ts, which decrypts when actually
// calling the provider — this file only ever encrypts. Kept as a small
// standalone module (not in @iconicedu/utils, which ui-web also depends on)
// so `node:crypto` never ends up in a browser bundle.
//
// This route handler runs server-side only (Next.js Route Handlers execute
// on the server, never in the client bundle), so node:crypto is safe here.

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
