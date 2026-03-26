import { createClient } from '@supabase/supabase-js';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function createSupabaseSessionClient(accessToken: string) {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const supabasePublishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();

  if (!supabasePublishableKey) {
    throw new Error(
      'Missing required environment variable: SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY',
    );
  }

  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
