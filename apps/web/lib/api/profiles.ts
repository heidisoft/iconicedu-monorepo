import type { SupabaseClient } from '@supabase/supabase-js';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';

export function ensureSystemProfile(supabase: SupabaseClient, input: { orgId: string }) {
  return createApiClient(supabase).post<{ id: string }>('/profiles/system', input);
}
