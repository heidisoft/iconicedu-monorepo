import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

/**
 * Resolves the Supabase URL for the current runtime environment.
 *
 * In local development (`EXPO_PUBLIC_APP_ENV=local`), the configured URL
 * (`EXPO_PUBLIC_SUPABASE_URL`) typically contains `127.0.0.1`, which only
 * works on an iOS Simulator. Android emulators and physical devices cannot
 * reach the host machine via `127.0.0.1`.
 *
 * To fix this automatically, we replace the hostname with the IP that the
 * Metro bundler is already listening on (`Constants.expoConfig?.hostUri`).
 * Metro's IP is reachable from any connected device or emulator, so Supabase
 * becomes reachable on the same network path.
 *
 * Examples at runtime:
 *   iOS Simulator  → Metro host 127.0.0.1  → http://127.0.0.1:54321
 *   Android Emu    → Metro host 10.0.2.2   → http://10.0.2.2:54321
 *   Physical device → Metro host 192.168.x.y → http://192.168.x.y:54321
 *
 * In all other environments (development EAS build, preview, production) the
 * configured URL is used as-is.
 */
function resolveSupabaseUrl(): string {
  const configured =
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://yneiylhtjuvraivkeone.supabase.co';

  if (process.env.EXPO_PUBLIC_APP_ENV !== 'local') return configured;

  // hostUri is provided by the Expo runtime when connected to a Metro server,
  // e.g. "192.168.1.42:8081". Only present during local development.
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return configured;

  const metroIp = hostUri.split(':')[0];
  if (!metroIp) return configured;

  try {
    const url = new URL(configured);
    url.hostname = metroIp;
    return url.toString();
  } catch {
    return configured;
  }
}

const SUPABASE_URL = resolveSupabaseUrl();

const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'test-anon-key';

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Implicit flow avoids PKCE code-verifier storage race conditions in React Native.
    // The redirect URL hash contains access_token + refresh_token directly.
    flowType: 'implicit',
  },
});
