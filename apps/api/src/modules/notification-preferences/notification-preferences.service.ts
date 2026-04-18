import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';

@Injectable()
export class NotificationPreferencesService {
  async list(
    accessToken: string,
    input: { orgId: string; profileId: string; prefKey?: string; scopeId?: string },
  ) {
    const supabase = createSupabaseSessionClient(accessToken);
    let query = supabase
      .from('notification_preferences')
      .select('*')
      .eq('org_id', input.orgId)
      .eq('profile_id', input.profileId)
      .is('deleted_at', null);
    if (input.prefKey) query = query.eq('pref_key', input.prefKey);
    if (input.scopeId) query = query.eq('scope_id', input.scopeId);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async upsert(
    accessToken: string,
    body: {
      orgId: string;
      profileId: string;
      prefKey: string;
      channels: string[];
      muted?: boolean;
      scopeKind?: string | null;
      scopeId?: string | null;
    },
  ) {
    const supabase = createSupabaseSessionClient(accessToken);
    const now = new Date().toISOString();
    const { error } = await supabase.from('notification_preferences').upsert(
      {
        org_id: body.orgId,
        profile_id: body.profileId,
        pref_key: body.prefKey,
        scope_kind: body.scopeKind ?? null,
        scope_id: body.scopeId ?? null,
        channels: body.channels,
        muted: body.muted ?? false,
        updated_at: now,
        updated_by: body.profileId,
      },
      { onConflict: 'org_id,profile_id,pref_key,scope_kind,scope_id' },
    );
    if (error) throw new InternalServerErrorException(error.message);
    return { success: true };
  }
}
