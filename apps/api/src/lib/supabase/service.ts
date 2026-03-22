import { createClient } from '@supabase/supabase-js';
import { getApiRuntimeEnv } from '@iconicedu/api/config/env';

export function createSupabaseServiceClient() {
  const { supabaseUrl, supabaseServiceRoleKey } = getApiRuntimeEnv();

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}

export type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceClient>;
