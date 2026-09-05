import type { ConnectionVM, SessionCompletionVM } from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';

export function listSessionCompletions(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    profileId: string;
    cursor?: string | null;
    limit?: number;
  },
) {
  return createApiClient(supabase).get<ConnectionVM<SessionCompletionVM>>(
    '/session-completions',
    input,
  );
}
