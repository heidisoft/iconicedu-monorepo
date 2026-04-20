import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';

@Injectable()
export class PushTokensService {
  async register(
    accessToken: string,
    body: { orgId: string; profileId: string; token: string; platform: string },
  ) {
    const supabase = createSupabaseSessionClient(accessToken);
    const { error } = await supabase.rpc('upsert_push_token', {
      _org_id: body.orgId,
      _profile_id: body.profileId,
      _token: body.token,
      _platform: body.platform,
      _now: new Date().toISOString(),
    });
    if (error) throw new InternalServerErrorException(error.message);
    return { success: true };
  }

  async revoke(accessToken: string, body: { token: string }) {
    const supabase = createSupabaseSessionClient(accessToken);
    const { error } = await supabase
      .from('push_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token', body.token);
    if (error) throw new InternalServerErrorException(error.message);
    return { success: true };
  }
}
