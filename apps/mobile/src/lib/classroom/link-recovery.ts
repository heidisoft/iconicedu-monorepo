import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
export type NativeMeetingLinkRecovery = {
  token?: string;
  displayName?: string;
  expiresAt: number;
};
const key = (id: string) => `classroom.link.${id.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
export async function readNativeMeetingLink(
  id: string,
): Promise<NativeMeetingLinkRecovery | null> {
  const stored = await SecureStore.getItemAsync(key(id));
  if (!stored) return null;
  try {
    const value = JSON.parse(stored) as NativeMeetingLinkRecovery;
    if (
      typeof value.expiresAt !== 'number' ||
      value.expiresAt <= Date.now() ||
      (value.token !== undefined && typeof value.token !== 'string') ||
      (value.displayName !== undefined && typeof value.displayName !== 'string')
    ) {
      await SecureStore.deleteItemAsync(key(id));
      return null;
    }
    return value;
  } catch {
    await SecureStore.deleteItemAsync(key(id));
    return null;
  }
}
export async function writeNativeMeetingLink(
  id: string,
  value: NativeMeetingLinkRecovery,
) {
  await SecureStore.setItemAsync(key(id), JSON.stringify(value), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
export async function rememberNativeInvitation(id: string, token: string) {
  const previous = await readNativeMeetingLink(id);
  await writeNativeMeetingLink(id, {
    token,
    displayName: previous?.displayName,
    expiresAt: Date.now() + 7 * 86400000,
  });
}

/** Persist the retry identity before consuming a single-use personal handoff. */
export async function nativeHandoffRedemptionKey(id: string, token: string) {
  const storageKey = `${key(id)}.handoff`;
  const raw = await SecureStore.getItemAsync(storageKey);
  if (raw) {
    try {
      const saved = JSON.parse(raw) as {
        token: string;
        redemptionKey: string;
        expiresAt: number;
      };
      if (
        saved.token === token &&
        saved.expiresAt > Date.now() &&
        /^[\w-]{32}$/.test(saved.redemptionKey)
      )
        return saved.redemptionKey;
    } catch {
      /* Replace invalid recovery metadata. */
    }
  }
  const redemptionKey = Crypto.randomUUID().replace(/-/g, '');
  await SecureStore.setItemAsync(
    storageKey,
    JSON.stringify({ token, redemptionKey, expiresAt: Date.now() + 60000 }),
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
  );
  return redemptionKey;
}
