import { requireMeetingAdmission, meetingAdmissionStatus } from './meeting-admissions';
import {
  issueMeetingLink,
  resolveMeetingLink,
  redeemMeetingHandoff,
} from './meeting-browser-links';
import { issueAnnotationAccess } from '../screen-annotations/annotation-access';
import { issueWhiteboardAccess } from '../whiteboards/whiteboard-access';
import { platformFeatureFlagKeys } from '@iconicedu/shared-types';
import { evaluateApiBooleanFlag } from '@iconicedu/api/lib/flags/posthog-openfeature';
import { parseLiveSessionSettings, settingsFromSnapshot } from './live-session-settings';
import type {
  LiveSessionJoinCredentialsVM,
  LiveSessionMemberAccessVM,
  PublicLiveSessionInfoVM,
} from '@iconicedu/shared-types';
import { createHash, randomUUID } from 'node:crypto';
import { formatMeetingStudentNames } from '@iconicedu/utils';

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
  hasOrgStaffRole,
  resolveAuthorizedLiveSessionProfileIds,
  verifyChannelMembership,
  getWebAppUrl,
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
  share_code?: string | null;
  org_id: string;
  id: string;
  provider: string;
  status: 'starting' | 'live' | 'ended' | 'failed';
  provider_session_id: string | null;
  provider_metadata: Record<string, unknown> | null;
  channel_id?: string;
  app_metadata?: Record<string, unknown> | null;
};

/** Host/member/guest clients must join the topic used by the provider's signed token. */
function resolveZoomSessionName(
  session: Pick<ChannelLiveSessionPublicRow, 'provider_session_id' | 'provider_metadata'>,
  joinAccess: { metadata?: Record<string, unknown> },
): string {
  const name =
    joinAccess.metadata?.sessionName ??
    session.provider_metadata?.sessionName ??
    session.provider_session_id;
  if (typeof name === 'string' && name.trim()) return name;
  // A database row ID is not a Zoom topic. Failing here avoids an isolated room.
  throw new InternalServerErrorException('Unable to resolve the classroom session');
}

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

function checkGuestJoinRateLimit(key: string, recordFailure = true) {
  const now = Date.now();

  guestJoinCallsSinceSweep += 1;
  if (guestJoinCallsSinceSweep >= GUEST_JOIN_SWEEP_INTERVAL_CALLS) {
    guestJoinCallsSinceSweep = 0;
    sweepExpiredGuestJoinAttempts(now);
  }

  const existing = guestJoinAttempts.get(key);

  if (!existing || now - existing.windowStartedAt > GUEST_JOIN_RATE_WINDOW_MS) {
    if (recordFailure) guestJoinAttempts.set(key, { count: 1, windowStartedAt: now });
    return;
  }

  if (existing.count >= GUEST_JOIN_RATE_LIMIT) {
    throw new HttpException(
      'Too many join attempts, try again shortly',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  if (recordFailure) existing.count += 1;
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

  async memberAccess(
    accessToken: string,
    sessionId: string,
    input: JoinLiveSessionDto,
  ): Promise<LiveSessionMemberAccessVM> {
    const db = createSupabaseServiceClient();
    const { profile } = await loadAndAuthorizeProfile({
      sessionSupabase: createSupabaseSessionClient(accessToken),
      serviceSupabase: db,
      orgId: input.orgId,
      profileId: input.profileId,
    });
    const result = await db
      .from('channel_live_sessions')
      .select(
        'id, org_id, channel_id, provider, provider_session_id, provider_metadata, share_code, status',
      )
      .eq('id', sessionId)
      .eq('org_id', input.orgId)
      .is('deleted_at', null)
      .maybeSingle();
    if (result.error) throw new InternalServerErrorException('Unable to load meeting');
    const session = result.data;
    if (!session || !['starting', 'live'].includes(session.status))
      throw new NotFoundException('Live session is not active');
    const ids = await resolveAuthorizedLiveSessionProfileIds({
      supabase: db,
      orgId: input.orgId,
      profile,
    });
    if (!(await verifyChannelMembership(db, input.orgId, session.channel_id, ids)))
      throw new ForbiddenException('Classroom access is required');
    const channelResult = await db
      .from('channels')
      .select('topic, purpose, kind, live_session_config')
      .eq('id', session.channel_id)
      .eq('org_id', input.orgId)
      .is('deleted_at', null)
      .maybeSingle();
    if (channelResult.error || !channelResult.data)
      throw new NotFoundException('Classroom not found');
    const channel = channelResult.data;
    const slug = await resolveOrgSlug(db, input.orgId);
    const returnPath = `/${slug}/${channel.purpose === 'learning-space' ? 's' : channel.kind === 'dm' || channel.kind === 'group_dm' ? 'dm' : 'c'}/${session.channel_id}`;
    if (session.provider === 'zoom') {
      const code =
        typeof session.share_code === 'string'
          ? session.share_code.match(/.{4}/g)?.join('-')
          : null;
      return { provider: 'zoom', joinPath: `/live/${code ?? session.id}`, returnPath };
    }
    const displayName =
      profile.display_name ??
      ([profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
        'Participant');
    const provider = session.provider as Exclude<LiveSessionProviderVM, 'zoom'>;
    const access = await getLiveSessionProvider(provider).getJoinAccess({
      sessionId: session.id,
      providerSessionId: session.provider_session_id,
      providerMetadata: session.provider_metadata ?? {},
      profileId: profile.id,
      displayName,
      isHost:
        profile.kind === 'educator' || (await hasOrgStaffRole(db, input.orgId, ids)),
    });
    return {
      provider,
      returnPath,
      channelTopic: channel.topic,
      channelPurpose: channel.purpose,
      channelKind: channel.kind,
      mode:
        channel.live_session_config?.mode === 'audio'
          ? 'audio'
          : channel.live_session_config?.mode === 'video'
            ? 'video'
            : null,
      joinUrl: access.joinUrl ?? null,
      token: access.token ?? null,
      externalJoinUrl:
        typeof access.metadata?.externalJoinUrl === 'string'
          ? access.metadata.externalJoinUrl
          : null,
      displayName,
    };
  }

  private async invitationPath(
    sessionId: string,
    passcode: string | null,
    shareCode?: string | null,
  ) {
    const token = await issueMeetingLink(sessionId, 'invite', null, passcode);
    const code = shareCode?.match(/.{4}/g)?.join('-') ?? sessionId;
    return new URL(`/live/${code}#invite=${token}`, getWebAppUrl()).toString();
  }

  async createInvitation(accessToken: string, identifier: string) {
    const info = await this.getPublicLiveSessionInfo(identifier, accessToken);
    if (!info.exists || !info.isActive || !info.sessionId)
      throw new NotFoundException('Live session is not active');
    const orgId = await this.sessionOrg(info.sessionId);
    const identity = await this.resolveLiveSessionIdentity(accessToken, orgId);
    if (!identity?.profileId)
      throw new ForbiddenException('Classroom access is required');
    return this.getShareInfo(accessToken, identifier, {
      orgId,
      profileId: identity.profileId,
    });
  }

  async createBrowserHandoff(accessToken: string, identifier: string) {
    const info = await this.getPublicLiveSessionInfo(identifier, accessToken);
    if (!info.exists || !info.isActive || !info.sessionId)
      throw new NotFoundException('Live session is not active');
    const identity = await this.resolveLiveSessionIdentity(
      accessToken,
      await this.sessionOrg(info.sessionId),
    );
    if (!identity?.profileId)
      throw new ForbiddenException('An active organization profile is required');
    const token = await issueMeetingLink(info.sessionId, 'handoff', identity.authUserId);
    const path = info.shareCode
      ? info.shareCode.match(/.{4}/g)!.join('-')
      : info.sessionId;
    return {
      browserPath: new URL(`/live/${path}#handoff=${token}`, getWebAppUrl()).toString(),
    };
  }

  private async sessionOrg(sessionId: string) {
    const result = await createSupabaseServiceClient()
      .from('channel_live_sessions')
      .select('org_id')
      .eq('id', sessionId)
      .is('deleted_at', null)
      .single<{ org_id: string }>();
    if (result.error || !result.data)
      throw new NotFoundException('Live session not found');
    return result.data.org_id;
  }

  async getLinkInfo(
    identifier: string,
    token: string,
    handoff: boolean,
    accessToken: string | null = null,
    clientIp = 'unknown',
    redemptionKey = '',
  ) {
    const publicInfo = await this.getPublicLiveSessionInfo(identifier, null);
    if (!publicInfo.exists || !publicInfo.isActive || !publicInfo.sessionId)
      throw new NotFoundException('Live session is not active');
    checkGuestJoinRateLimit(`link:${identifier}:${clientIp}`, false);
    try {
      const linkToken = handoff
        ? await redeemMeetingHandoff(token, publicInfo.sessionId, redemptionKey)
        : token;
      const info = await this.getPublicLiveSessionInfo(
        publicInfo.sessionId,
        handoff ? null : accessToken,
        linkToken,
      );
      return { info, linkToken };
    } catch (error) {
      if (error instanceof ForbiddenException)
        checkGuestJoinRateLimit(`link:${identifier}:${clientIp}`);
      throw error;
    }
  }

  async admissionStatus(sessionId: string, token: string, cancel = false) {
    return meetingAdmissionStatus(sessionId, token, cancel);
  }

  async moderateAdmissions(
    sessionId: string,
    accessToken: string | null,
    linkToken?: string,
    decision?: { id: string; approved: boolean },
  ) {
    const db = createSupabaseServiceClient();
    const session = await db
      .from('channel_live_sessions')
      .select('id, org_id, provider_metadata, status')
      .eq('id', sessionId)
      .is('deleted_at', null)
      .maybeSingle();
    if (session.error) throw new InternalServerErrorException('Unable to verify meeting');
    if (!session.data || !['starting', 'live'].includes(session.data.status))
      throw new NotFoundException('Session has ended');
    const passcode =
      typeof session.data.provider_metadata?.passcode === 'string'
        ? session.data.provider_metadata.passcode
        : null;
    const link = linkToken
      ? await resolveMeetingLink(linkToken, sessionId, passcode)
      : null;
    const identity = accessToken
      ? await this.resolveLiveSessionIdentity(accessToken, session.data.org_id)
      : link?.auth_user_id
        ? await this.resolveLiveSessionUser(link.auth_user_id, session.data.org_id)
        : null;
    if (!(await this.isMeetingHost(sessionId, identity)))
      throw new ForbiddenException('Teacher or staff access required');
    if (decision) {
      const result = await db
        .from('live_session_admissions')
        .update({ status: decision.approved ? 'approved' : 'denied' })
        .eq('id', decision.id)
        .eq('live_session_id', sessionId)
        .eq('status', 'waiting')
        .gt('expires_at', new Date().toISOString())
        .select('id')
        .maybeSingle();
      if (result.error)
        throw new InternalServerErrorException('Unable to update admission');
      if (!result.data) throw new NotFoundException('Request is no longer waiting');
      return { success: true };
    }
    const result = await db
      .from('live_session_admissions')
      .select('id, display_name, created_at')
      .eq('live_session_id', sessionId)
      .eq('status', 'waiting')
      .gt('expires_at', new Date().toISOString())
      .order('created_at')
      .limit(100);
    if (result.error)
      throw new InternalServerErrorException('Unable to load waiting room');
    return (result.data ?? []).map((row) => ({
      id: row.id,
      displayName: row.display_name,
      createdAt: row.created_at,
    }));
  }

  async getShareInfo(accessToken: string, identifier: string, input: JoinLiveSessionDto) {
    const isCode = /^[a-f0-9]{4}(-[a-f0-9]{4}){2}$/i.test(identifier);
    if (
      !isCode &&
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(identifier)
    )
      throw new NotFoundException('Live session not found');
    const serviceSupabase = createSupabaseServiceClient();
    const { profile } = await loadAndAuthorizeProfile({
      sessionSupabase: createSupabaseSessionClient(accessToken),
      serviceSupabase,
      orgId: input.orgId,
      profileId: input.profileId,
    });
    const response = await serviceSupabase
      .from('channel_live_sessions')
      .select('id, org_id, channel_id, share_code, provider, provider_metadata')
      .eq('org_id', input.orgId)
      .eq(
        isCode ? 'share_code' : 'id',
        isCode ? identifier.replace(/-/g, '').toLowerCase() : identifier,
      )
      .is('deleted_at', null)
      .maybeSingle<{
        id: string;
        org_id: string;
        channel_id: string;
        share_code: string | null;
        provider: string;
        provider_metadata: Record<string, unknown> | null;
      }>();
    if (response.error)
      throw new InternalServerErrorException('Unable to load meeting details');
    const session = response.data;
    if (!session || session.provider !== 'zoom')
      throw new NotFoundException('Live session not found');
    const profileIds = await resolveAuthorizedLiveSessionProfileIds({
      supabase: serviceSupabase,
      orgId: input.orgId,
      profile,
    });
    if (
      !(await verifyChannelMembership(
        serviceSupabase,
        input.orgId,
        session.channel_id,
        profileIds,
      ))
    )
      throw new ForbiddenException('Classroom access is required');
    const code =
      typeof session.share_code === 'string'
        ? session.share_code.match(/.{4}/g)?.join('-')
        : null;
    const joinPath = new URL(`/live/${code ?? session.id}`, getWebAppUrl()).toString();
    const invite = await issueMeetingLink(
      session.id,
      'invite',
      null,
      typeof session.provider_metadata?.passcode === 'string'
        ? session.provider_metadata.passcode
        : null,
    );
    return {
      joinPath,
      sharePath: `${joinPath}#invite=${invite}`,
      provider: 'zoom' as const,
      passcode:
        typeof session.provider_metadata?.passcode === 'string'
          ? session.provider_metadata.passcode
          : null,
    };
  }

  // Public (no-auth): gated by the session's passcode rather than channel
  // membership, so anyone with a shared link can join a Zoom-provider session.
  async guestJoinLiveSession(
    sessionId: string,
    clientIp: string,
    input: GuestJoinLiveSessionDto,
    accessToken: string | null = null,
  ): Promise<LiveSessionJoinCredentialsVM> {
    const serviceSupabase = createSupabaseServiceClient();
    const sessionResponse = await serviceSupabase
      .from('channel_live_sessions')
      .select(
        'id, share_code, org_id, provider, status, channel_id, provider_session_id, provider_metadata, app_metadata',
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
    const link = input.linkToken
      ? await resolveMeetingLink(input.linkToken, session.id, storedPasscode)
      : null;
    const identity = accessToken
      ? await this.resolveLiveSessionIdentity(accessToken, session.org_id)
      : link?.auth_user_id
        ? await this.resolveLiveSessionUser(link.auth_user_id, session.org_id)
        : null;
    if (link?.auth_user_id && !identity?.profileId)
      throw new ForbiddenException('Meeting access has expired');
    const isStaff = identity?.profileId
      ? await hasOrgStaffRole(serviceSupabase, session.org_id, [identity.profileId])
      : false;
    const students = isStaff
      ? undefined
      : await this.guardianStudents(identity, session.org_id, session.channel_id);
    const isHost =
      students === undefined && (await this.isMeetingHost(session.id, identity));
    if (!identity && link?.purpose !== 'invite' && !isHost) {
      checkGuestJoinRateLimit(`${sessionId}:${clientIp}`, false);
      if (!verifyZoomPasscode(storedPasscode, input.passcode)) {
        checkGuestJoinRateLimit(`${sessionId}:${clientIp}`);
        throw new ForbiddenException('Incorrect passcode');
      }
    }
    const requestedStudents =
      input.studentProfileIds ??
      (input.studentProfileId ? [input.studentProfileId] : undefined);
    if (requestedStudents && students === undefined)
      throw new ForbiddenException(
        'Student selection is only available to linked parents',
      );
    const selectedStudents =
      students === undefined
        ? []
        : requestedStudents
          ? students.filter((student) => requestedStudents.includes(student.profileId))
          : students.length === 1
            ? students
            : [];
    if (
      students !== undefined &&
      (!selectedStudents.length ||
        (requestedStudents && selectedStudents.length !== requestedStudents.length))
    ) {
      if (requestedStudents || !students.length)
        throw new ForbiddenException(
          'No linked student enrolled in this class was selected',
        );
      throw new BadRequestException('Choose which students are joining');
    }
    const student = selectedStudents.length === 1 ? selectedStudents[0] : undefined;
    const sharedStudents = selectedStudents.length > 1;
    const selectedIds = selectedStudents.map((student) => student.profileId).sort();
    const joiningProfileId =
      student?.profileId ??
      (sharedStudents
        ? `shared:${createHash('sha256')
            .update(JSON.stringify([identity?.authUserId, selectedIds]))
            .digest('hex')
            .slice(0, 28)}`
        : identity?.profileId);
    // guardianStudents has already checked every selected child's active class enrollment.
    const membershipProfileId = selectedStudents[0]?.profileId ?? identity?.profileId;
    if (!settings.invite.enabled && !isHost && !isStaff) {
      if (!joiningProfileId || !session.channel_id)
        throw new ForbiddenException('Shared invitations are disabled');
      const membership = await serviceSupabase
        .from('channel_members')
        .select('id')
        .eq('org_id', session.org_id)
        .eq('channel_id', session.channel_id)
        .eq('profile_id', membershipProfileId)
        .is('deleted_at', null)
        .maybeSingle();
      if (membership.error)
        throw new InternalServerErrorException('Unable to verify meeting membership');
      if (!membership.data)
        throw new ForbiddenException('Shared invitations are disabled');
    }
    const displayName =
      input.displayNameOverride ??
      (selectedStudents.length
        ? formatMeetingStudentNames(
            selectedStudents.map((student) => student.displayName),
          )
        : undefined) ??
      identity?.displayName ??
      input.displayName;
    const mode = settings.access?.mode ?? 'open';
    if (mode !== 'open' && !isHost && !isStaff) {
      let enrolled = false;
      if (joiningProfileId) {
        const membership = await serviceSupabase
          .from('channel_members')
          .select('id')
          .eq('org_id', session.org_id)
          .eq('channel_id', session.channel_id)
          .eq('profile_id', membershipProfileId)
          .is('deleted_at', null)
          .maybeSingle();
        if (membership.error)
          throw new InternalServerErrorException('Unable to verify admission');
        enrolled = !!membership.data;
      }
      if (mode === 'restricted' || !enrolled)
        await requireMeetingAdmission(
          session.id,
          input.admissionToken,
          JSON.stringify([
            identity?.authUserId ?? 'guest',
            sharedStudents ? selectedIds : (student?.profileId ?? null),
            input.displayName,
            storedPasscode,
          ]),
          displayName,
        );
    }
    const provider = getLiveSessionProvider('zoom');
    const joinAccess = await provider.getJoinAccess({
      sessionId: session.id,
      providerSessionId: session.provider_session_id,
      providerMetadata: metadata,
      profileId: joiningProfileId ?? `guest:${randomUUID()}`,
      displayName,
      isHost,
    });

    if (!joinAccess.token)
      throw new InternalServerErrorException('Unable to issue session credentials');

    return {
      ...(settings.invite.enabled
        ? {
            sharePath: await this.invitationPath(
              session.id,
              storedPasscode,
              session.share_code,
            ),
          }
        : {}),
      ...(identity ? { meetingPasscode: storedPasscode } : {}),
      ...(selectedStudents.length ? { studentProfileIds: selectedIds } : {}),
      ...(student ? { studentProfileId: student.profileId } : {}),
      ...(!identity?.profileId ||
      selectedStudents.length > 0 ||
      link?.purpose === 'access' ||
      (!isHost && input.displayNameOverride)
        ? {
            annotationToken: await (link?.purpose === 'access' &&
            !selectedStudents.length &&
            identity
              ? issueAnnotationAccess(session.id, displayName, identity.authUserId)
              : issueAnnotationAccess(session.id, displayName)),
          }
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
      sessionName: resolveZoomSessionName(session, joinAccess),
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
    linkToken?: string,
  ): Promise<PublicLiveSessionInfoVM> {
    const isShareCode = /^[a-f0-9]{4}(-[a-f0-9]{4}){2}$/i.test(sessionId);
    const serviceSupabase = createSupabaseServiceClient();
    const sessionResponse = await serviceSupabase
      .from('channel_live_sessions')
      .select(
        'id, share_code, org_id, provider, status, channel_id, started_by_profile_id, provider_session_id, provider_metadata, app_metadata',
      )
      .eq(
        isShareCode ? 'share_code' : 'id',
        isShareCode ? sessionId.replace(/-/g, '').toLowerCase() : sessionId,
      )
      .is('deleted_at', null)
      .maybeSingle<{
        id: string;
        share_code?: string;
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

    const passcode =
      typeof session.provider_metadata?.passcode === 'string'
        ? session.provider_metadata.passcode
        : null;
    const link = linkToken
      ? await resolveMeetingLink(linkToken, session.id, passcode)
      : null;
    const identity = accessToken
      ? await this.resolveLiveSessionIdentity(accessToken, session.org_id)
      : link?.auth_user_id
        ? await this.resolveLiveSessionUser(link.auth_user_id, session.org_id)
        : null;
    if (link?.auth_user_id && !identity?.profileId)
      throw new ForbiddenException('Meeting access has expired');
    const isStaff = identity?.profileId
      ? await hasOrgStaffRole(serviceSupabase, session.org_id, [identity.profileId])
      : false;
    const students = isStaff
      ? undefined
      : await this.guardianStudents(identity, session.org_id, session.channel_id);
    const isHost =
      students === undefined && (await this.isMeetingHost(session.id, identity));
    if (!isHost || !identity?.profileId) {
      return {
        exists: true as const,
        isActive: true as const,
        sessionId: session.id,
        shareCode: session.share_code,
        sessionTitle,
        isHost: false as const,
        passcodeRequired: !identity && !link,
        settings,
        ...(!identity && link?.purpose === 'invite'
          ? { participant: { displayName: 'Guest' } }
          : {}),
        ...(identity
          ? {
              participant: {
                displayName:
                  students === undefined
                    ? identity.displayName
                    : students.length === 1
                      ? students[0].displayName
                      : 'Student',
                ...(students !== undefined ? { students } : {}),
              },
            }
          : {}),
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
        sessionId: session.id,
        shareCode: session.share_code,
        sessionTitle,
        isHost: false as const,
        passcodeRequired: !identity && !link,
        settings,
      };
    }

    return {
      exists: true as const,
      isActive: true as const,
      sessionId: session.id,
      shareCode: session.share_code,
      sessionTitle,
      isHost: true as const,
      settings,
      hostJoin: {
        ...(link?.purpose === 'access'
          ? {
              annotationToken: await issueAnnotationAccess(
                session.id,
                displayName,
                identity.authUserId,
              ),
            }
          : {}),
        ...(settings.invite.enabled
          ? {
              sharePath: await this.invitationPath(
                session.id,
                passcode,
                session.share_code,
              ),
            }
          : {}),
        ...(settings.whiteboard.enabled
          ? {
              whiteboard: await this.whiteboardAccess(session.id, 'teacher', displayName),
            }
          : {}),
        token: joinAccess.token,
        expiresAt: joinAccess.expiresAt ?? null,
        settings,
        sessionName: resolveZoomSessionName(session, joinAccess),
        displayName,
        passcode:
          typeof session.provider_metadata?.passcode === 'string'
            ? session.provider_metadata.passcode
            : null,
      },
    };
  }

  /** Resolve only the verified caller's identity in the session org.
   * Passcodes are required only for anonymous guests. Verified callers still
   * follow invitation policy, guardian enrollment, and tenant checks. Their Zoom identity is still an anonymous guest.
   */
  private async resolveLiveSessionIdentity(accessToken: string, orgId: string) {
    const { data } = await createSupabaseSessionClient(accessToken).auth.getUser();
    const user = data.user;
    if (!user) return null;
    return this.resolveLiveSessionUser(user.id, orgId, user.user_metadata);
  }

  private async resolveLiveSessionUser(
    authUserId: string,
    orgId: string,
    userMetadata?: Record<string, unknown>,
  ) {
    const service = createSupabaseServiceClient();
    const account = await service
      .from('accounts')
      .select('id')
      .eq('auth_user_id', authUserId)
      .eq('org_id', orgId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();
    if (account.error)
      throw new InternalServerErrorException('Unable to resolve participant identity');
    const profile = account.data
      ? await service
          .from('profiles')
          .select('id, kind, display_name, first_name, last_name')
          .eq('account_id', account.data.id)
          .eq('org_id', orgId)
          .is('deleted_at', null)
          .maybeSingle<{
            id: string;
            kind: string;
            display_name: string | null;
            first_name: string | null;
            last_name: string | null;
          }>()
      : null;
    if (profile?.error)
      throw new InternalServerErrorException('Unable to resolve participant identity');
    const row = profile?.data;
    const metadataName = userMetadata?.full_name ?? userMetadata?.name;
    const displayName =
      row?.display_name?.trim() ||
      [row?.first_name, row?.last_name].filter(Boolean).join(' ').trim() ||
      (typeof metadataName === 'string' ? metadataName.trim() : '') ||
      'Participant';
    return {
      authUserId,
      accountId: account.data?.id ?? null,
      kind: row?.kind ?? null,
      profileId: row?.id ?? null,
      displayName: displayName.slice(0, 80),
    };
  }

  /** Only active linked children enrolled in this exact class can be represented. */
  private async guardianStudents(
    identity: Awaited<ReturnType<LiveSessionsService['resolveLiveSessionIdentity']>>,
    orgId: string,
    channelId: string | null | undefined,
  ): Promise<import('@iconicedu/shared-types').LiveSessionStudentOptionVM[] | undefined> {
    if (identity?.kind !== 'guardian' || !identity.accountId) return undefined;
    if (!channelId) return [];
    const db = createSupabaseServiceClient();
    const links = await db
      .from('family_links')
      .select('child_account_id')
      .eq('org_id', orgId)
      .eq('guardian_account_id', identity.accountId)
      .is('deleted_at', null);
    if (links.error)
      throw new InternalServerErrorException('Unable to load linked students');
    const ids = [
      ...new Set((links.data ?? []).map((link) => link.child_account_id as string)),
    ];
    if (!ids.length) return [];
    const profiles = await db
      .from('profiles')
      .select(
        'id, display_name, first_name, last_name, accounts!profiles_account_id_fkey!inner(id)',
      )
      .eq('org_id', orgId)
      .eq('kind', 'child')
      .in('account_id', ids)
      .is('deleted_at', null)
      .eq('accounts.status', 'active')
      .is('accounts.deleted_at', null);
    if (profiles.error)
      throw new InternalServerErrorException('Unable to load linked students');
    if (!profiles.data?.length) return [];
    const members = await db
      .from('channel_members')
      .select('profile_id')
      .eq('org_id', orgId)
      .eq('channel_id', channelId)
      .in(
        'profile_id',
        profiles.data.map((profile) => profile.id),
      )
      .is('deleted_at', null);
    if (members.error)
      throw new InternalServerErrorException('Unable to verify student enrollment');
    const enrolled = new Set((members.data ?? []).map((member) => member.profile_id));
    return profiles.data
      .filter((profile) => enrolled.has(profile.id))
      .map((profile) => ({
        profileId: profile.id,
        displayName: (
          profile.display_name?.trim() ||
          [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() ||
          'Student'
        ).slice(0, 80),
      }))
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
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
      .select('id, org_id, channel_id, provider_metadata')
      .eq('id', sessionId)
      .is('deleted_at', null)
      .maybeSingle<{
        id: string;
        org_id: string;
        channel_id: string;
        provider_metadata?: Record<string, unknown> | null;
      }>();

    if (sessionResponse.error) {
      throw new InternalServerErrorException(sessionResponse.error.message);
    }
    const session = sessionResponse.data;
    if (!session) {
      throw new NotFoundException('Live session not found');
    }

    let identity: Awaited<ReturnType<LiveSessionsService['resolveLiveSessionIdentity']>> =
      null;
    if (accessToken)
      identity = await this.resolveLiveSessionIdentity(accessToken, session.org_id);
    else if (input.linkToken) {
      const link = await resolveMeetingLink(input.linkToken, session.id, null);
      if (link?.purpose === 'access' && link.auth_user_id)
        identity = await this.resolveLiveSessionUser(link.auth_user_id, session.org_id);
    }
    if (!identity?.profileId || !(await this.isMeetingHost(session.id, identity)))
      throw new ForbiddenException('Meeting host access required');
    const actorProfileId = identity.profileId;

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
