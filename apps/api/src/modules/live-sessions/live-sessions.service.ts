import { issueAnnotationAccess } from '../screen-annotations/annotation-access';
import { issueWhiteboardAccess } from '../whiteboards/whiteboard-access';
import { platformFeatureFlagKeys } from '@iconicedu/shared-types';
import { evaluateApiBooleanFlag } from '@iconicedu/api/lib/flags/posthog-openfeature';
import { parseLiveSessionSettings, settingsFromSnapshot } from './live-session-settings';
import type {
  LiveSessionJoinCredentialsVM,
  PublicLiveSessionInfoVM,
} from '@iconicedu/shared-types';
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
import type { ReportLiveSessionQualityEventDto } from '@iconicedu/api/modules/live-sessions/dto/report-live-session-quality-event.dto';
import type { LogLiveSessionAuditEventDto } from '@iconicedu/api/modules/live-sessions/dto/log-live-session-audit-event.dto';

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
  org_id: string;
  id: string;
  provider: string;
  status: 'starting' | 'live' | 'ended' | 'failed';
  provider_session_id: string | null;
  provider_metadata: Record<string, unknown> | null;
  channel_id?: string;
  app_metadata?: Record<string, unknown> | null;
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

// Quality events are client-throttled to only fire on a level change (see
// the Zoom embed), so a session rarely sends more than a handful per minute
// in practice — this is a generous backstop, not the primary throttle.
const QUALITY_EVENT_RATE_LIMIT = 30;
const QUALITY_EVENT_RATE_WINDOW_MS = 60_000;
const QUALITY_EVENT_SWEEP_INTERVAL_CALLS = 100;
const qualityEventAttempts = new Map<
  string,
  { count: number; windowStartedAt: number }
>();
let qualityEventCallsSinceSweep = 0;

function checkQualityEventRateLimit(key: string) {
  const now = Date.now();

  qualityEventCallsSinceSweep += 1;
  if (qualityEventCallsSinceSweep >= QUALITY_EVENT_SWEEP_INTERVAL_CALLS) {
    qualityEventCallsSinceSweep = 0;
    for (const [mapKey, entry] of qualityEventAttempts) {
      if (now - entry.windowStartedAt > QUALITY_EVENT_RATE_WINDOW_MS) {
        qualityEventAttempts.delete(mapKey);
      }
    }
  }

  const existing = qualityEventAttempts.get(key);
  if (!existing || now - existing.windowStartedAt > QUALITY_EVENT_RATE_WINDOW_MS) {
    qualityEventAttempts.set(key, { count: 1, windowStartedAt: now });
    return;
  }

  if (existing.count >= QUALITY_EVENT_RATE_LIMIT) {
    throw new HttpException('Too many quality reports', HttpStatus.TOO_MANY_REQUESTS);
  }

  existing.count += 1;
}

// A handful of privileged actions per session is the expected case — this is
// a backstop against a misbehaving client, not an expected usage ceiling.
const AUDIT_EVENT_RATE_LIMIT = 60;
const AUDIT_EVENT_RATE_WINDOW_MS = 60_000;
const AUDIT_EVENT_SWEEP_INTERVAL_CALLS = 100;
const auditEventAttempts = new Map<string, { count: number; windowStartedAt: number }>();
let auditEventCallsSinceSweep = 0;

function checkAuditEventRateLimit(key: string) {
  const now = Date.now();

  auditEventCallsSinceSweep += 1;
  if (auditEventCallsSinceSweep >= AUDIT_EVENT_SWEEP_INTERVAL_CALLS) {
    auditEventCallsSinceSweep = 0;
    for (const [mapKey, entry] of auditEventAttempts) {
      if (now - entry.windowStartedAt > AUDIT_EVENT_RATE_WINDOW_MS) {
        auditEventAttempts.delete(mapKey);
      }
    }
  }

  const existing = auditEventAttempts.get(key);
  if (!existing || now - existing.windowStartedAt > AUDIT_EVENT_RATE_WINDOW_MS) {
    auditEventAttempts.set(key, { count: 1, windowStartedAt: now });
    return;
  }

  if (existing.count >= AUDIT_EVENT_RATE_LIMIT) {
    throw new HttpException('Too many audit events', HttpStatus.TOO_MANY_REQUESTS);
  }

  existing.count += 1;
}

@Injectable()
export class LiveSessionsService {
  /** Optional collaboration failures cannot prevent authorized audio/video joins. */
  private async whiteboardAccess(
    sessionId: string,
    role: 'teacher' | 'student',
    name: string,
  ) {
    try {
      return await issueWhiteboardAccess(sessionId, role, name);
    } catch {
      this.logger.warn('Class whiteboard unavailable during authorized meeting join');
      return { provider: 'excalidraw' as const, unavailable: true };
    }
  }

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
    const channelSettings = await serviceSupabase
      .from('channels')
      .select('live_session_config')
      .eq('id', channelId)
      .eq('org_id', input.orgId)
      .is('deleted_at', null)
      .maybeSingle();
    if (channelSettings.error)
      throw new InternalServerErrorException('Unable to load meeting settings');
    const config = channelSettings.data?.live_session_config as Record<
      string,
      unknown
    > | null;
    const configurable =
      config?.settings &&
      (await evaluateApiBooleanFlag({
        flagKey: platformFeatureFlagKeys.enableClassroomMeetingSettings,
        distinctId:
          typeof config.settingsProfileId === 'string'
            ? config.settingsProfileId
            : profile.id,
      }));
    const meetingSettings = configurable
      ? parseLiveSessionSettings(config.settings)
      : undefined;

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
        ...(meetingSettings ? { meetingSettings } : {}),
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
    accessToken: string | null = null,
  ): Promise<LiveSessionJoinCredentialsVM> {
    checkGuestJoinRateLimit(`${sessionId}:${clientIp}`);

    const serviceSupabase = createSupabaseServiceClient();
    const sessionResponse = await serviceSupabase
      .from('channel_live_sessions')
      .select(
        'id, org_id, provider, status, channel_id, provider_session_id, provider_metadata, app_metadata',
      )
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

    const settings = settingsFromSnapshot(session.app_metadata);
    const metadata = session.provider_metadata ?? {};
    const storedPasscode =
      typeof metadata.passcode === 'string' ? metadata.passcode : null;
    const identity = accessToken
      ? await this.resolveLiveSessionIdentity(accessToken, session.org_id)
      : null;
    const isHost = await this.isMeetingHost(session.id, identity);
    if (!isHost && !verifyZoomPasscode(storedPasscode, input.passcode)) {
      throw new ForbiddenException('Incorrect passcode');
    }
    if (!settings.invite.enabled && !isHost) {
      if (!identity?.profileId || !session.channel_id)
        throw new ForbiddenException('Shared invitations are disabled');
      const membership = await serviceSupabase
        .from('channel_members')
        .select('id')
        .eq('org_id', session.org_id)
        .eq('channel_id', session.channel_id)
        .eq('profile_id', identity.profileId)
        .is('deleted_at', null)
        .maybeSingle();
      if (membership.error)
        throw new InternalServerErrorException('Unable to verify meeting membership');
      if (!membership.data)
        throw new ForbiddenException('Shared invitations are disabled');
    }
    const displayName = identity?.displayName ?? input.displayName;
    const provider = getLiveSessionProvider('zoom');
    const joinAccess = await provider.getJoinAccess({
      sessionId: session.id,
      providerSessionId: session.provider_session_id,
      providerMetadata: metadata,
      profileId: identity?.profileId ?? `guest:${randomUUID()}`,
      displayName,
      isHost,
    });

    if (!joinAccess.token)
      throw new InternalServerErrorException('Unable to issue session credentials');

    return {
      ...(!identity?.profileId
        ? { annotationToken: await issueAnnotationAccess(session.id, displayName) }
        : {}),
      ...(settings.whiteboard.enabled
        ? {
            whiteboard: await this.whiteboardAccess(
              session.id,
              isHost ? 'teacher' : 'student',
              displayName,
            ),
          }
        : {}),
      token: joinAccess.token,
      sessionName:
        typeof metadata.sessionName === 'string' ? metadata.sessionName : session.id,
      displayName,
      expiresAt: joinAccess.expiresAt ?? null,
      settings,
    };
  }

  // Public (no-auth required, but auth-aware): backs the shared /live/:sessionId
  // landing page for both anonymous guests and the signed-in host. Centralizing
  // this here (rather than in apps/web, which previously queried Supabase
  // directly with a service-role client) keeps privileged reads and the
  // host-detection logic in the one place other live-session authorization
  // already lives.
  async getPublicLiveSessionInfo(
    sessionId: string,
    accessToken: string | null,
  ): Promise<PublicLiveSessionInfoVM> {
    const serviceSupabase = createSupabaseServiceClient();
    const sessionResponse = await serviceSupabase
      .from('channel_live_sessions')
      .select(
        'id, org_id, provider, status, channel_id, started_by_profile_id, provider_session_id, provider_metadata, app_metadata',
      )
      .eq('id', sessionId)
      .is('deleted_at', null)
      .maybeSingle<{
        id: string;
        org_id: string;
        provider: string;
        status: 'starting' | 'live' | 'ended' | 'failed';
        channel_id: string;
        started_by_profile_id: string;
        provider_session_id: string | null;
        provider_metadata: Record<string, unknown> | null;
        app_metadata?: Record<string, unknown> | null;
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
    const settings = settingsFromSnapshot(session.app_metadata);

    if (session.status !== 'starting' && session.status !== 'live') {
      return { exists: true as const, isActive: false as const, sessionTitle };
    }

    const identity = accessToken
      ? await this.resolveLiveSessionIdentity(accessToken, session.org_id)
      : null;
    const isHost = await this.isMeetingHost(session.id, identity);
    if (!isHost || !identity?.profileId) {
      return {
        exists: true as const,
        isActive: true as const,
        sessionTitle,
        isHost: false as const,
        settings,
        ...(identity ? { participant: { displayName: identity.displayName } } : {}),
      };
    }
    const displayName = identity.displayName;
    const provider = getLiveSessionProvider(session.provider as LiveSessionProviderVM);
    const joinAccess = await provider.getJoinAccess({
      sessionId: session.id,
      providerSessionId: session.provider_session_id,
      providerMetadata: session.provider_metadata,
      profileId: identity.profileId,
      displayName,
      isHost: true,
    });

    if (!joinAccess.token) {
      return {
        exists: true as const,
        isActive: true as const,
        sessionTitle,
        isHost: false as const,
        settings,
      };
    }

    return {
      exists: true as const,
      isActive: true as const,
      sessionTitle,
      isHost: true as const,
      settings,
      hostJoin: {
        ...(settings.whiteboard.enabled
          ? {
              whiteboard: await this.whiteboardAccess(session.id, 'teacher', displayName),
            }
          : {}),
        token: joinAccess.token,
        expiresAt: joinAccess.expiresAt ?? null,
        settings,
        sessionName:
          typeof joinAccess.metadata?.sessionName === 'string'
            ? joinAccess.metadata.sessionName
            : session.id,
        displayName,
        passcode:
          typeof session.provider_metadata?.passcode === 'string'
            ? session.provider_metadata.passcode
            : null,
      },
    };
  }

  /** Resolve only the verified caller's identity in the session org.
   * Passcode verification remains mandatory for non-hosts, including callers
   * without an org profile. Their Zoom identity is still an anonymous guest.
   */
  private async resolveLiveSessionIdentity(accessToken: string, orgId: string) {
    const { data } = await createSupabaseSessionClient(accessToken).auth.getUser();
    const user = data.user;
    if (!user) return null;
    const service = createSupabaseServiceClient();
    const account = await service
      .from('accounts')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle<{ id: string }>();
    if (account.error)
      throw new InternalServerErrorException('Unable to resolve participant identity');
    const profile = account.data
      ? await service
          .from('profiles')
          .select('id, display_name, first_name, last_name')
          .eq('account_id', account.data.id)
          .eq('org_id', orgId)
          .is('deleted_at', null)
          .maybeSingle<{
            id: string;
            display_name: string | null;
            first_name: string | null;
            last_name: string | null;
          }>()
      : null;
    if (profile?.error)
      throw new InternalServerErrorException('Unable to resolve participant identity');
    const row = profile?.data;
    const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name;
    const displayName =
      row?.display_name?.trim() ||
      [row?.first_name, row?.last_name].filter(Boolean).join(' ').trim() ||
      (typeof metadataName === 'string' ? metadataName.trim() : '') ||
      'Participant';
    return {
      authUserId: user.id,
      profileId: row?.id ?? null,
      displayName: displayName.slice(0, 80),
    };
  }

  /** The caller identity is verified with auth.getUser before this authorization RPC. */
  private async isMeetingHost(
    sessionId: string,
    identity: { authUserId: string; profileId: string | null } | null,
  ): Promise<boolean> {
    if (!identity?.profileId) return false;
    const result = await createSupabaseServiceClient().rpc('live_session_can_host', {
      p_session: sessionId,
      p_user: identity.authUserId,
    });
    if (result.error)
      throw new InternalServerErrorException('Unable to verify meeting host permissions');
    return result.data === true;
  }

  // Best-effort: resolves the caller's own profile within this session's org
  // from a bearer token, for attribution only — unlike isMeetingHost
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

  // Lets staff spot which active/past rooms had connection trouble (FR-043) —
  // see the Zoom embed's network-quality-change/connection-change listeners,
  // which call this only on a degraded transition, not on every tick.
  async reportLiveSessionQualityEvent(
    sessionId: string,
    clientIp: string,
    accessToken: string | null,
    input: ReportLiveSessionQualityEventDto,
  ) {
    checkQualityEventRateLimit(`${sessionId}:${clientIp}`);

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
      .from('channel_live_session_quality_events')
      .insert({
        org_id: session.org_id,
        live_session_id: session.id,
        channel_id: session.channel_id,
        profile_id: profileId,
        display_name: input.displayName,
        metric: input.metric,
        level: input.level,
        occurred_at: input.occurredAt,
      });

    if (insertResponse.error) {
      throw new InternalServerErrorException(insertResponse.error.message);
    }

    return { success: true as const };
  }

  // Stub audit trail for privileged in-session actions (FR-044) — records
  // who did what, but has no admin UI surfacing it yet. Covers only the
  // actions that exist today (host-forced mute, end-for-everyone, and
  // automatic recording start); extend ACTIONS in the DTO as more are built.
  async logLiveSessionAuditEvent(
    sessionId: string,
    clientIp: string,
    accessToken: string | null,
    input: LogLiveSessionAuditEventDto,
  ) {
    checkAuditEventRateLimit(`${sessionId}:${clientIp}`);

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

    const actorProfileId = accessToken
      ? await this.resolveProfileIdForAccessToken(accessToken, session.org_id)
      : null;

    const insertResponse = await serviceSupabase
      .from('channel_live_session_audit_events')
      .insert({
        org_id: session.org_id,
        live_session_id: session.id,
        channel_id: session.channel_id,
        actor_profile_id: actorProfileId,
        action: input.action,
        metadata: input.targetDisplayName
          ? { targetDisplayName: input.targetDisplayName }
          : {},
        occurred_at: input.occurredAt,
      });

    if (insertResponse.error) {
      throw new InternalServerErrorException(insertResponse.error.message);
    }

    return { success: true as const };
  }
}
