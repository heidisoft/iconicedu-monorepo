/**
 * Generates a client-side message id used as `clientMessageId` on send
 * inputs (see `MessageSendTextInput.clientMessageId` in
 * `@iconicedu/shared-types`). Retrying a send with the same id is
 * idempotent — the server returns the already-created message instead of
 * inserting a duplicate.
 *
 * Mirrors `apps/mobile/src/lib/messages/client-message-id.ts` so both
 * platforms share the same id shape. This is not cryptographically secure
 * and does not need to be: it is only used as a client-generated idempotency
 * key, never for auth or security. The Math.random fallback exists because
 * `crypto.randomUUID` isn't guaranteed to be present in every browser/test
 * runtime this component renders under.
 */
export function generateClientMessageId(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof globalCrypto?.randomUUID === 'function') {
    return globalCrypto.randomUUID();
  }

  let seed = Date.now();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const randomValue = ((seed + Math.random() * 16) % 16) | 0;
    seed = Math.floor(seed / 16);
    const value = char === 'x' ? randomValue : (randomValue & 0x3) | 0x8;
    return value.toString(16);
  });
}
