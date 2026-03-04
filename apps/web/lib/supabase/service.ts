import { createClient } from '@supabase/supabase-js';
import { getServiceWebEnv } from '@iconicedu/web/lib/config/env';

export const createSupabaseServiceClient = () => {
  const { supabaseUrl, supabaseServiceRoleKey } = getServiceWebEnv();

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
};

export type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceClient>;
