import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'parent-referral-v1';
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const CODE = /^[a-f0-9]{48}$/;
export type PendingParentReferral = {
  code: string;
  savedAt: number;
  ownerId: string | null;
};

/** Extract only an opaque code. Never navigate to or fetch a pasted URL. */
export function parseParentReferralCode(input: string): string | null {
  const value = input.trim();
  if (CODE.test(value)) return value;
  try {
    const url = new URL(value);
    if (!['https:', 'http:', 'iconicedu:'].includes(url.protocol)) return null;
    const path =
      url.protocol === 'iconicedu:' ? `/${url.hostname}${url.pathname}` : url.pathname;
    const match = /^\/r\/([a-f0-9]{48})\/?$/.exec(path);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function savePendingParentReferral(code: string, ownerId: string | null) {
  if (!CODE.test(code)) throw new Error('Enter a valid invitation link or code.');
  const value: PendingParentReferral = { code, ownerId, savedAt: Date.now() };
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(value));
}
export async function clearPendingParentReferral(expected?: {
  code: string;
  ownerId: string;
}) {
  if (expected) {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return;
    try {
      const value = JSON.parse(raw) as PendingParentReferral;
      if (value.code !== expected.code || value.ownerId !== expected.ownerId) return;
    } catch {
      return;
    }
  }
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}
export async function readPendingParentReferral(
  userId: string,
): Promise<PendingParentReferral | null> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!raw) return null;
  let value: PendingParentReferral;
  try {
    value = JSON.parse(raw);
  } catch {
    await clearPendingParentReferral();
    return null;
  }
  if (
    !value ||
    !CODE.test(value.code) ||
    !Number.isFinite(value.savedAt) ||
    value.savedAt > Date.now() ||
    Date.now() - value.savedAt > MAX_AGE ||
    (value.ownerId !== null && value.ownerId !== userId)
  ) {
    await clearPendingParentReferral();
    return null;
  }
  // Bind an anonymous invitation on first authenticated use. Another account cannot consume it.
  if (!value.ownerId) {
    value.ownerId = userId;
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(value));
  }
  return value;
}
