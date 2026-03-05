import { randomUUID } from 'crypto';

import type { SupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

export async function ensureSystemProfileId(
  supabase: SupabaseServiceClient,
  orgId: string,
): Promise<string> {
  const existing = await supabase
    .from('profiles')
    .select('id')
    .eq('org_id', orgId)
    .eq('kind', 'system')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existing.error) {
    throw new Error(existing.error.message);
  }
  if (existing.data?.id) {
    return existing.data.id;
  }

  const now = new Date().toISOString();
  const accountResponse = await supabase
    .from('accounts')
    .insert({
      org_id: orgId,
      status: 'active',
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single<{ id: string }>();

  if (accountResponse.error) {
    throw new Error(accountResponse.error.message);
  }

  const profileResponse = await supabase
    .from('profiles')
    .insert({
      org_id: orgId,
      account_id: accountResponse.data.id,
      kind: 'system',
      display_name: 'System',
      first_name: 'System',
      last_name: null,
      avatar_source: 'seed',
      avatar_seed: `system:${orgId}:${randomUUID()}`,
      timezone: 'UTC',
      status: 'active',
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single<{ id: string }>();

  if (profileResponse.error) {
    throw new Error(profileResponse.error.message);
  }

  return profileResponse.data.id;
}
