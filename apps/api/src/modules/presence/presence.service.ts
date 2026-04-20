import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';

@Injectable()
export class PresenceService {
  async list(accessToken: string, input: { orgId: string; profileIds: string[] }) {
    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('profile_presence')
      .select('profile_id, live_status, display_status, last_seen_at, deleted_at')
      .eq('org_id', input.orgId)
      .in('profile_id', input.profileIds)
      .is('deleted_at', null);
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async update(body: { orgId: string; profileId: string; status: string }) {
    const supabase = createSupabaseServiceClient();
    const now = new Date().toISOString();
    const liveStatus =
      body.status === 'online'
        ? 'in_class'
        : body.status === 'away'
          ? 'away'
          : body.status;
    const { error } = await supabase.from('profile_presence').upsert(
      {
        org_id: body.orgId,
        profile_id: body.profileId,
        live_status: liveStatus,
        display_status: body.status,
        last_seen_at: now,
        presence_loaded: true,
        deleted_at: null,
      },
      { onConflict: 'org_id,profile_id' },
    );
    if (error) throw new InternalServerErrorException(error.message);
    return { success: true };
  }
}
