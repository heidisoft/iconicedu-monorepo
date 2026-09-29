import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { createOrJoinLiveSession } from '@iconicedu/live-sessions-core';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { loadAndAuthorizeProfile } from '@iconicedu/api/lib/actor/resolve-actor-profile';
import type { JoinLiveSessionDto } from '@iconicedu/api/modules/live-sessions/dto/join-live-session.dto';

async function resolveOrgSlug(
  serviceSupabase: ReturnType<typeof createSupabaseServiceClient>,
  orgId: string,
): Promise<string> {
  const response = await serviceSupabase
    .from('orgs')
    .select('slug')
    .eq('id', orgId)
    .is('deleted_at', null)
    .maybeSingle<{ slug: string | null }>();

  if (response.error) {
    throw new InternalServerErrorException(response.error.message);
  }
  if (!response.data?.slug) {
    throw new BadRequestException('Organization not found');
  }

  return response.data.slug;
}

@Injectable()
export class LiveSessionsService {
  private readonly logger = new Logger(LiveSessionsService.name);

  async joinLiveSession(
    accessToken: string,
    channelId: string,
    input: JoinLiveSessionDto,
  ) {
    const sessionSupabase = createSupabaseSessionClient(accessToken);
    const serviceSupabase = createSupabaseServiceClient();

    const [{ profile, account }, orgSlug] = await Promise.all([
      loadAndAuthorizeProfile({
        sessionSupabase,
        serviceSupabase,
        orgId: input.orgId,
        profileId: input.profileId,
      }),
      resolveOrgSlug(serviceSupabase, input.orgId),
    ]);

    const { data: authUser } = await sessionSupabase.auth.getUser();

    try {
      return await createOrJoinLiveSession({
        serviceSupabase,
        actor: {
          authUserId: authUser?.user?.id ?? '',
          account,
          profile,
        },
        channelId,
        orgSlug,
        onPostJoinSideEffectError: (info) => {
          this.logger.error(
            `Post-join side effects failed for session ${info.sessionId} in channel ${info.channelId}`,
            info.error instanceof Error ? info.error.stack : String(info.error),
          );
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to join live session';
      if (message === 'Unauthorized') {
        throw new ForbiddenException(message);
      }
      if (
        message === 'Channel not found' ||
        message === 'Live sessions are not enabled for this channel' ||
        message === 'Custom live session join URL is missing' ||
        message === 'Archived classrooms cannot start or join live sessions'
      ) {
        throw new BadRequestException(message);
      }
      throw new InternalServerErrorException(message);
    }
  }
}
