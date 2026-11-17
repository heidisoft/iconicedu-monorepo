import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/lib/supabase/client';

/** Client retry identity only; apps/api decides whether admission is required/approved. */
export async function nativeAdmissionToken(
  sessionId: string,
  displayName: string,
  studentProfileId?: string | string[],
  linkToken?: string,
): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const identity = JSON.stringify([
    session?.user.id ?? null,
    displayName,
    Array.isArray(studentProfileId)
      ? studentProfileId.length === 1
        ? studentProfileId[0]
        : [...studentProfileId].sort()
      : (studentProfileId ?? null),
    linkToken ?? null,
  ]);
  const storageKey = `classroom.admission.${sessionId.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const raw = await SecureStore.getItemAsync(storageKey);
  if (raw) {
    try {
      const saved = JSON.parse(raw) as {
        identity: string;
        token: string;
        expiresAt: number;
      };
      if (
        saved.identity === identity &&
        saved.expiresAt > Date.now() &&
        /^[\w-]{32}$/.test(saved.token)
      )
        return saved.token;
    } catch {
      /* Invalid metadata is replaced before requesting admission. */
    }
  }
  const token = Crypto.randomUUID().replace(/-/g, '');
  await SecureStore.setItemAsync(
    storageKey,
    JSON.stringify({ identity, token, expiresAt: Date.now() + 24 * 3600000 }),
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
  );
  return token;
}
