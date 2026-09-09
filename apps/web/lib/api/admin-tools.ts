import type {
  AdminToolsDispatchRequest,
  AdminToolsDispatchResponse,
} from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';

export function dispatchAdminTool(
  supabase: SupabaseClient,
  input: AdminToolsDispatchRequest,
) {
  return createApiClient(supabase).post<AdminToolsDispatchResponse>(
    '/admin/tools/dispatch',
    input,
  );
}
