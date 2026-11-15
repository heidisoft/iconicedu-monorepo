import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { LiveSessionQualityEventVM } from '@iconicedu/shared-types';
import { requireAdminAccount } from '@iconicedu/api/lib/auth/require-admin-account';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

@Injectable()
export class LiveSessionQualityService {
  async list(
    accessToken: string,
    orgId: string,
    sessionId: string,
  ): Promise<LiveSessionQualityEventVM[]> {
    const auth = await createSupabaseSessionClient(accessToken).auth.getUser();
    if (auth.error || !auth.data.user) throw new ForbiddenException('Unauthorized');
    await requireAdminAccount(auth.data.user.id, orgId);
    const db = createSupabaseServiceClient();
    const session = await db
      .from('channel_live_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle();
    if (session.error) throw new InternalServerErrorException('Unable to load meeting');
    if (!session.data) throw new NotFoundException('Live session not found');
    const result = await db
      .from('channel_live_session_quality_events')
      .select('id, display_name, metric, level, occurred_at')
      .eq('org_id', orgId)
      .eq('live_session_id', sessionId)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false })
      .returns<LiveSessionQualityEventVM[]>();
    if (result.error)
      throw new InternalServerErrorException('Unable to load meeting quality events');
    return result.data ?? [];
  }
}
