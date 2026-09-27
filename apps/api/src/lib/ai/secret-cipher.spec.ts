import { randomBytes } from 'node:crypto';
import { decryptSecret, encryptSecret } from './secret-cipher';

const KEY = randomBytes(32).toString('base64');
const OTHER_KEY = randomBytes(32).toString('base64');

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a plaintext secret', () => {
    const ciphertext = encryptSecret('sk-ant-super-secret-key', KEY);
    expect(ciphertext).not.toContain('sk-ant-super-secret-key');
    expect(decryptSecret(ciphertext, KEY)).toBe('sk-ant-super-secret-key');
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const first = encryptSecret('same-plaintext', KEY);
    const second = encryptSecret('same-plaintext', KEY);
    expect(first).not.toBe(second);
  });

  it('fails to decrypt with the wrong key', () => {
    const ciphertext = encryptSecret('sk-ant-super-secret-key', KEY);
    expect(() => decryptSecret(ciphertext, OTHER_KEY)).toThrow();
  });

  it('rejects a malformed ciphertext', () => {
    expect(() => decryptSecret('not-a-valid-ciphertext', KEY)).toThrow(/malformed/i);
  });

  it('rejects a key that is not a 32-byte base64 value', () => {
    expect(() => encryptSecret('secret', 'too-short')).toThrow(/32 bytes/);
  });
});
