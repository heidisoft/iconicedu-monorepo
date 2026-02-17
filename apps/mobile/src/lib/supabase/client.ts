import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

const SUPABASE_URL =
  (extra.EXPO_PUBLIC_SUPABASE_URL as string) ??
  'https://yneiylhtjuvraivkeone.supabase.co';

const SUPABASE_ANON_KEY =
  (extra.EXPO_PUBLIC_SUPABASE_ANON_KEY as string) ??
  '';

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
  },
});
