import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  createOrJoinLiveSession,
  getLiveSessionProvider,
  verifyZoomPasscode,
} from '@iconicedu/live-sessions-core';
import type { LiveSessionProviderVM } from '@iconicedu/shared-types';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { loadAndAuthorizeProfile } from '@iconicedu/api/lib/actor/resolve-actor-profile';
import type { JoinLiveSessionDto } from '@iconicedu/api/modules/live-sessions/dto/join-live-session.dto';
import type { GuestJoinLiveSessionDto } from '@iconicedu/api/modules/live-sessions/dto/guest-join-live-session.dto';
import type { SubmitLiveSessionFeedbackDto } from '@iconicedu/api/modules/live-sessions/dto/submit-live-session-feedback.dto';

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

type ChannelLiveSessionPublicRow = {
  id: string;
  provider: string;
  status: 'starting' | 'live' | 'ended' | 'failed';
  provider_session_id: string | null;
  provider_metadata: Record<string, unknown> | null;
};

// Best-effort, process-local guard against passcode brute-forcing on the
// unauthenticated guest-join endpoint. Not distributed — fine for a single
// Railway instance, but a horizontally-scaled deployment would need a shared
// store (e.g. Redis) for this to hold across instances.
const GUEST_JOIN_RATE_LIMIT = 5;
const GUEST_JOIN_RATE_WINDOW_MS = 60_000;
// How often (in calls) to sweep expired entries, so this map doesn't grow
// unbounded across every session/guest-IP pair ever seen over the process's
// lifetime — a plain per-key TTL alone never fires for keys nobody revisits.
const GUEST_JOIN_SWEEP_INTERVAL_CALLS = 100;
const guestJoinAttempts = new Map<string, { count: number; windowStartedAt: number }>();
let guestJoinCallsSinceSweep = 0;

function sweepExpiredGuestJoinAttempts(now: number) {
  for (const [key, entry] of guestJoinAttempts) {
    if (now - entry.windowStartedAt > GUEST_JOIN_RATE_WINDOW_MS) {
      guestJoinAttempts.delete(key);
    }
  }
}

function checkGuestJoinRateLimit(key: string) {
  const now = Date.now();

  guestJoinCallsSinceSweep += 1;
  if (guestJoinCallsSinceSweep >= GUEST_JOIN_SWEEP_INTERVAL_CALLS) {
    guestJoinCallsSinceSweep = 0;
    sweepExpiredGuestJoinAttempts(now);
  }

  const existing = guestJoinAttempts.get(key);

  if (!existing || now - existing.windowStartedAt > GUEST_JOIN_RATE_WINDOW_MS) {
    guestJoinAttempts.set(key, { count: 1, windowStartedAt: now });
    return;
  }

  if (existing.count >= GUEST_JOIN_RATE_LIMIT) {
    throw new HttpException(
      'Too many join attempts, try again shortly',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  existing.count += 1;
}

// Same process-local, sweep-on-interval pattern as the guest-join limiter
// above — this endpoint is also unauthenticated (guests can submit
// feedback), just with a much lower limit since one submission per person
// per session is the expected case.
const FEEDBACK_RATE_LIMIT = 3;
const FEEDBACK_RATE_WINDOW_MS = 60_000;
const FEEDBACK_SWEEP_INTERVAL_CALLS = 100;
const feedbackAttempts = new Map<string, { count: number; windowStartedAt: number }>();
let feedbackCallsSinceSweep = 0;

function checkFeedbackRateLimit(key: string) {
  const now = Date.now();

  feedbackCallsSinceSweep += 1;
  if (feedbackCallsSinceSweep >= FEEDBACK_SWEEP_INTERVAL_CALLS) {
    feedbackCallsSinceSweep = 0;
    for (const [mapKey, entry] of feedbackAttempts) {
      if (now - entry.windowStartedAt > FEEDBACK_RATE_WINDOW_MS) {
        feedbackAttempts.delete(mapKey);
      }
    }
  }

  const existing = feedbackAttempts.get(key);
  if (!existing || now - existing.windowStartedAt > FEEDBACK_RATE_WINDOW_MS) {
    feedbackAttempts.set(key, { count: 1, windowStartedAt: now });
    return;
  }

  if (existing.count >= FEEDBACK_RATE_LIMIT) {
    throw new HttpException(
      'Too many feedback submissions, try again shortly',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  existing.count += 1;
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

  // Public (no-auth): gated by the session's passcode rather than channel
  // membership, so anyone with a shared link can join a Zoom-provider session.
  async guestJoinLiveSession(
    sessionId: string,
    clientIp: string,
    input: GuestJoinLiveSessionDto,
  ) {
    checkGuestJoinRateLimit(`${sessionId}:${clientIp}`);

    const serviceSupabase = createSupabaseServiceClient();
    const sessionResponse = await serviceSupabase
      .from('channel_live_sessions')
      .select('id, provider, status, provider_session_id, provider_metadata')
      .eq('id', sessionId)
      .is('deleted_at', null)
      .maybeSingle<ChannelLiveSessionPublicRow>();

    if (sessionResponse.error) {
      throw new InternalServerErrorException(sessionResponse.error.message);
    }
    const session = sessionResponse.data;
    if (!session) {
      throw new NotFoundException('Live session not found');
    }
    if (session.provider !== 'zoom') {
      throw new BadRequestException('Guest join is only available for Zoom sessions');
    }
    if (session.status !== 'starting' && session.status !== 'live') {
      throw new BadRequestException('Live session is not active');
    }

    const metadata = session.provider_metadata ?? {};
    const storedPasscode =
      typeof metadata.passcode === 'string' ? metadata.passcode : null;
    if (!verifyZoomPasscode(storedPasscode, input.passcode)) {
      throw new ForbiddenException('Incorrect passcode');
    }

    const provider = getLiveSessionProvider('zoom');
    const joinAccess = await provider.getJoinAccess({
      sessionId: session.id,
      providerSessionId: session.provider_session_id,
      providerMetadata: metadata,
      profileId: `guest:${randomUUID()}`,
      displayName: input.displayName,
      isHost: false,
    });

    return {
      token: joinAccess.token,
      sessionName:
        typeof metadata.sessionName === 'string' ? metadata.sessionName : session.id,
      displayName: input.displayName,
      expiresAt: joinAccess.expiresAt ?? null,
    };
  }

  // Public (no-auth required, but auth-aware): backs the shared /live/:sessionId
  // landing page for both anonymous guests and the signed-in host. Centralizing
  // this here (rather than in apps/web, which previously queried Supabase
  // directly with a service-role client) keeps privileged reads and the
  // host-detection logic in the one place other live-session authorization
  // already lives.
  async getPublicLiveSessionInfo(sessionId: string, accessToken: string | null) {
    const serviceSupabase = createSupabaseServiceClient();
    const sessionResponse = await serviceSupabase
      .from('channel_live_sessions')
      .select(
        'id, provider, status, channel_id, started_by_profile_id, provider_session_id, provider_metadata',
      )
      .eq('id', sessionId)
      .is('deleted_at', null)
      .maybeSingle<{
        id: string;
        provider: string;
        status: 'starting' | 'live' | 'ended' | 'failed';
        channel_id: string;
        started_by_profile_id: string;
        provider_session_id: string | null;
        provider_metadata: Record<string, unknown> | null;
      }>();

    if (sessionResponse.error) {
      throw new InternalServerErrorException(sessionResponse.error.message);
    }
    const session = sessionResponse.data;
    if (!session || session.provider !== 'zoom') {
      return { exists: false as const };
    }

    const channelResponse = await serviceSupabase
      .from('channels')
      .select('topic')
      .eq('id', session.channel_id)
      .maybeSingle<{ topic: string | null }>();
    const sessionTitle = channelResponse.data?.topic ?? 'Live Session';

    if (session.status !== 'starting' && session.status !== 'live') {
      return { exists: true as const, isActive: false as const, sessionTitle };
    }

    const isSessionStarter = accessToken
      ? await this.isAccessTokenForProfile(accessToken, session.started_by_profile_id)
      : false;

    if (!isSessionStarter) {
      return {
        exists: true as const,
        isActive: true as const,
        sessionTitle,
        isHost: false as const,
      };
    }

    const starterProfileResponse = await serviceSupabase
      .from('profiles')
      .select('id, display_name, first_name, last_name')
      .eq('id', session.started_by_profile_id)
      .maybeSingle<{
        id: string;
        display_name: string | null;
        first_name: string | null;
        last_name: string | null;
      }>();
    const starterProfile = starterProfileResponse.data;
    if (!starterProfile) {
      return {
        exists: true as const,
        isActive: true as const,
        sessionTitle,
        isHost: false as const,
      };
    }

    const displayName =
      starterProfile.display_name ??
      ([starterProfile.first_name, starterProfile.last_name].filter(Boolean).join(' ') ||
        'Host');
    const provider = getLiveSessionProvider(session.provider as LiveSessionProviderVM);
    const joinAccess = await provider.getJoinAccess({
      sessionId: session.id,
      providerSessionId: session.provider_session_id,
      providerMetadata: session.provider_metadata,
      profileId: starterProfile.id,
      displayName,
      isHost: true,
    });

    if (!joinAccess.token) {
      return {
        exists: true as const,
        isActive: true as const,
        sessionTitle,
        isHost: false as const,
      };
    }

    return {
      exists: true as const,
      isActive: true as const,
      sessionTitle,
      isHost: true as const,
      hostJoin: {
        token: joinAccess.token,
        sessionName:
          typeof joinAccess.metadata?.sessionName === 'string'
            ? joinAccess.metadata.sessionName
            : session.id,
        displayName,
      },
    };
  }

  // Verifies the bearer token the normal way (a real Supabase auth call, not
  // just decoding the JWT) before trusting it for host detection — this
  // gates who gets a host-role Zoom token (recording auto-start, moderator
  // capabilities), so it needs real verification, not just a best-effort read.
  private async isAccessTokenForProfile(
    accessToken: string,
    profileId: string,
  ): Promise<boolean> {
    const sessionSupabase = createSupabaseSessionClient(accessToken);
    const { data: authData } = await sessionSupabase.auth.getUser();
    if (!authData.user) {
      return false;
    }

    const serviceSupabase = createSupabaseServiceClient();
    const profileResponse = await serviceSupabase
      .from('profiles')
      .select('account_id')
      .eq('id', profileId)
      .maybeSingle<{ account_id: string }>();
    if (!profileResponse.data) {
      return false;
    }

    const accountResponse = await serviceSupabase
      .from('accounts')
      .select('auth_user_id')
      .eq('id', profileResponse.data.account_id)
      .maybeSingle<{ auth_user_id: string | null }>();

    return accountResponse.data?.auth_user_id === authData.user.id;
  }

  // Best-effort: resolves the caller's own profile within this session's org
  // from a bearer token, for attribution only — unlike isAccessTokenForProfile
  // this isn't gating a privileged action, so a verification failure just
  // means the feedback is recorded without a profile_id (same as a guest).
  private async resolveProfileIdForAccessToken(
    accessToken: string,
    orgId: string,
  ): Promise<string | null> {
    const sessionSupabase = createSupabaseSessionClient(accessToken);
    const { data: authData } = await sessionSupabase.auth.getUser();
    if (!authData.user) {
      return null;
    }

    const serviceSupabase = createSupabaseServiceClient();
    const accountResponse = await serviceSupabase
      .from('accounts')
      .select('id')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle<{ id: string }>();
    if (!accountResponse.data) {
      return null;
    }

    const profileResponse = await serviceSupabase
      .from('profiles')
      .select('id')
      .eq('account_id', accountResponse.data.id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();

    return profileResponse.data?.id ?? null;
  }

  // Public (no-auth required, but auth-aware, like getPublicLiveSessionInfo):
  // anyone who was in the session — host, member, or anonymous guest — can
  // leave a rating. An access token attributes it to a profile; without one
  // (or if verification fails) it's recorded the same way a guest's is.
  async submitLiveSessionFeedback(
    sessionId: string,
    clientIp: string,
    accessToken: string | null,
    input: SubmitLiveSessionFeedbackDto,
  ) {
    checkFeedbackRateLimit(`${sessionId}:${clientIp}`);

    const serviceSupabase = createSupabaseServiceClient();
    const sessionResponse = await serviceSupabase
      .from('channel_live_sessions')
      .select('id, org_id, channel_id')
      .eq('id', sessionId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string; org_id: string; channel_id: string }>();

    if (sessionResponse.error) {
      throw new InternalServerErrorException(sessionResponse.error.message);
    }
    const session = sessionResponse.data;
    if (!session) {
      throw new NotFoundException('Live session not found');
    }

    const profileId = accessToken
      ? await this.resolveProfileIdForAccessToken(accessToken, session.org_id)
      : null;

    const insertResponse = await serviceSupabase
      .from('channel_live_session_feedback')
      .insert({
        org_id: session.org_id,
        live_session_id: session.id,
        channel_id: session.channel_id,
        profile_id: profileId,
        display_name: input.displayName,
        rating: input.rating,
      });

    if (insertResponse.error) {
      throw new InternalServerErrorException(insertResponse.error.message);
    }

    return { success: true as const };
  }
}
