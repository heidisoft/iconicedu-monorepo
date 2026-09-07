import type {
  AdminSessionCompletionVM,
  ChannelSessionCompletionVM,
  ConnectionVM,
  SessionCompletionVM,
} from '@iconicedu/shared-types';
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

export function listAdminSessionCompletions(
  supabase: SupabaseClient,
  input: { orgId: string },
) {
  return createApiClient(supabase).get<AdminSessionCompletionVM[]>(
    '/session-completions/admin',
    input,
  );
}

export function getSessionCompletionSummary(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    profileId: string;
    completedSince?: string;
    completedUntil?: string;
  },
) {
  return createApiClient(supabase).get<{ completed: number; pending: number }>(
    '/session-completions/summary',
    input,
  );
}

export function getOrgSessionCompletionSummary(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    completedSince?: string;
    completedUntil?: string;
  },
) {
  return createApiClient(supabase).get<{ completed: number; pending: number }>(
    '/session-completions/org-summary',
    input,
  );
}

export function listChannelSessionCompletions(
  supabase: SupabaseClient,
  input: { orgId: string; channelId: string },
) {
  return createApiClient(supabase).get<{
    completions: ChannelSessionCompletionVM[];
    disputed: ChannelSessionCompletionVM[];
  }>('/session-completions/channel-states', input);
}
