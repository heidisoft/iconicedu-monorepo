/**
 * Generates a client-side message id used as `clientMessageId` on send
 * inputs (see `MessageSendTextInput.clientMessageId` in @iconicedu/shared-types).
 * Retrying a send with the same id is idempotent — the server returns the
 * already-created message instead of inserting a duplicate.
 *
 * This is not cryptographically secure and does not need to be: it is only
 * used as a client-generated idempotency key, never for auth or security.
 * No new dependency is added for this — the repo does not have expo-crypto
 * installed, so we generate a UUID-v4-shaped string from Math.random.
 */
export function generateClientMessageId(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof globalCrypto?.randomUUID === 'function') {
    return globalCrypto.randomUUID();
  }

  let seed = Date.now();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    // Deterministic-looking but non-cryptographic PRNG mix, sufficient for an
    // idempotency key that only needs to be unique per device per send.
    const randomValue = ((seed + Math.random() * 16) % 16) | 0;
    seed = Math.floor(seed / 16);
    const value = char === 'x' ? randomValue : (randomValue & 0x3) | 0x8;
    return value.toString(16);
  });
}
