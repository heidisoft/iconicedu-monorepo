import { resolveChannelLiveSessionScope } from '@iconicedu/live-sessions-core';
import { classroomCallWindow } from './classroom-call-window';
import { ChannelsService } from '../channels/channels.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  platformFeatureFlagKeys,
  type ClassroomCallVM,
  type ClassroomRosterVM,
  type ClassroomCallStatusVM,
} from '@iconicedu/shared-types';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { evaluateApiBooleanFlag } from '@iconicedu/api/lib/flags/posthog-openfeature';
import { sendPushNotification } from '@iconicedu/api/lib/notifications/providers/push-provider';

type Db = ReturnType<typeof createSupabaseServiceClient>;
type Profile = {
  id: string;
  account_id: string;
  kind: string;
  display_name: string | null;
};
type Session = {
  id: string;
  org_id: string;
  channel_id: string;
  status: string;
  share_code: string;
  occurrence_key?: string | null;
  app_metadata?: Record<string, unknown> | null;
};
type Invitation = {
  id: string;
  live_session_id: string;
  caller_profile_id: string;
  recipient_profile_id: string;
  status: ClassroomCallStatusVM;
  expires_at: string;
  created_at: string;
};
const recent = () => new Date(Date.now() - 45_000).toISOString();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function checked<T>(result: { data: T; error: unknown }, message: string): T {
  if (result.error) throw new InternalServerErrorException(message);
  return result.data;
}
export function eligibleClassMember(profile: Profile, excludedAccounts: Set<string>) {
  return (
    ['educator', 'guardian', 'child'].includes(profile.kind) &&
    !excludedAccounts.has(profile.account_id)
  );
}
export function callView(
  row: Invitation,
  title: string,
  callerName: string,
): ClassroomCallVM {
  return {
    id: row.id,
    sessionId: row.live_session_id,
    callerName,
    classTitle: title,
    status:
      row.status === 'ringing' && Date.parse(row.expires_at) <= Date.now()
        ? 'expired'
        : row.status,
    expiresAt: row.expires_at,
  };
}
@Injectable()
export class ClassroomCallsService {
  constructor(private readonly channels: ChannelsService) {}
  private readonly flagCache = new Map<string, { enabled: boolean; until: number }>();
  private async enabled(profileId: string) {
    const cached = this.flagCache.get(profileId);
    if (cached && cached.until > Date.now()) return cached.enabled;
    const enabled = await evaluateApiBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableClassroomCalls,
      distinctId: profileId,
    });
    if (this.flagCache.size >= 5000) this.flagCache.clear();
    this.flagCache.set(profileId, { enabled, until: Date.now() + 30_000 });
    return enabled;
  }

  private db() {
    return createSupabaseServiceClient();
  }
  private async accountIds(db: Db, token: string, orgId?: string) {
    const user = await createSupabaseSessionClient(token).auth.getUser();
    if (user.error || !user.data.user)
      throw new ForbiddenException('Sign in to use class calls');
    let query = db
      .from('accounts')
      .select('id, org_id')
      .eq('auth_user_id', user.data.user.id)
      .is('deleted_at', null);
    if (orgId) query = query.eq('org_id', orgId);
    const accounts = checked(await query, 'Unable to verify your account') as {
      id: string;
      org_id: string;
    }[];
    if (!accounts.length) throw new ForbiddenException('Classroom access required');
    return accounts;
  }
  private async profiles(
    db: Db,
    accountIds: string[],
    orgId?: string,
  ): Promise<Profile[]> {
    if (!accountIds.length) return [];
    let query = db
      .from('profiles')
      .select('id, account_id, kind, display_name')
      .in('account_id', accountIds)
      .is('deleted_at', null);
    if (orgId) query = query.eq('org_id', orgId);
    return checked(await query, 'Unable to load class identities') as Profile[];
  }
  private async represented(db: Db, token: string, orgId?: string) {
    const own = await this.accountIds(db, token, orgId);
    const links = checked(
      await db
        .from('family_links')
        .select('child_account_id')
        .in(
          'guardian_account_id',
          own.map((a) => a.id),
        )
        .is('deleted_at', null),
      'Unable to verify family access',
    ) as { child_account_id: string }[];
    return {
      own,
      profiles: await this.profiles(
        db,
        [...own.map((a) => a.id), ...links.map((l) => l.child_account_id)],
        orgId,
      ),
    };
  }
  private async session(db: Db, id: string, allowEnded = false): Promise<Session> {
    if (id.length > 64 || !/^[a-z0-9-]+$/i.test(id))
      throw new BadRequestException('Invalid classroom');
    const query = db
      .from('channel_live_sessions')
      .select('id, org_id, channel_id, status, share_code, occurrence_key, app_metadata')
      .is('deleted_at', null);
    const result = await (
      uuid.test(id) ? query.eq('id', id) : query.eq('share_code', id.replace(/-/g, ''))
    ).maybeSingle();
    const row = checked(result, 'Unable to load classroom') as Session | null;
    if (!row || (!allowEnded && row.status !== 'live'))
      throw new NotFoundException('This class is no longer live');
    return row;
  }
  private async context(token: string, id: string, allowEnded = false) {
    const db = this.db();
    const session = await this.session(db, id, allowEnded);
    const represented = await this.represented(db, token, session.org_id);
    const ownProfiles = represented.profiles.filter((p) =>
      represented.own.some((a) => a.id === p.account_id),
    );
    const enabled = await this.enabled(ownProfiles[0]?.id ?? 'anonymous');
    if (!enabled) throw new NotFoundException('Class calls are not available');
    const memberships = checked(
      await db
        .from('channel_members')
        .select('profile_id')
        .eq('org_id', session.org_id)
        .eq('channel_id', session.channel_id)
        .is('deleted_at', null),
      'Unable to load class roster',
    ) as { profile_id: string }[];
    const memberIds = memberships.map((m) => m.profile_id);
    if (!represented.profiles.some((p) => memberIds.includes(p.id)))
      throw new ForbiddenException('Classroom membership required');
    const profiles = memberIds.length
      ? (checked(
          await db
            .from('profiles')
            .select('id, account_id, kind, display_name')
            .eq('org_id', session.org_id)
            .in('id', memberIds)
            .is('deleted_at', null),
          'Unable to load class roster',
        ) as Profile[])
      : [];
    const roles = profiles.length
      ? (checked(
          await db
            .from('user_roles')
            .select('account_id, role_key')
            .eq('org_id', session.org_id)
            .in(
              'account_id',
              profiles.map((p) => p.account_id),
            )
            .in('role_key', ['owner', 'admin', 'staff'])
            .is('deleted_at', null),
          'Unable to verify class roles',
        ) as { account_id: string }[])
      : [];
    const accounts = profiles.length
      ? (checked(
          await db
            .from('accounts')
            .select('id, primary_role')
            .eq('org_id', session.org_id)
            .in(
              'id',
              profiles.map((p) => p.account_id),
            )
            .is('deleted_at', null),
          'Unable to verify class accounts',
        ) as { id: string; primary_role?: string | null }[])
      : [];
    const excluded = new Set([
      ...roles.map((r) => r.account_id),
      ...accounts
        .filter((a) => ['owner', 'admin', 'staff'].includes(a.primary_role ?? ''))
        .map((a) => a.id),
      ...profiles
        .filter((p) => !accounts.some((a) => a.id === p.account_id))
        .map((p) => p.account_id),
    ]);
    const members = profiles.filter((p) => eligibleClassMember(p, excluded));
    const teacher = ownProfiles.find(
      (p) => p.kind === 'educator' && members.some((m) => m.id === p.id),
    );
    const presence = checked(
      await db
        .from('classroom_call_presence')
        .select('profile_id')
        .eq('live_session_id', session.id)
        .gt('last_seen_at', recent()),
      'Unable to load attendance',
    ) as { profile_id: string }[];
    const joined = new Set(presence.map((p) => p.profile_id));
    const channel = checked(
      await db
        .from('channels')
        .select('topic')
        .eq('id', session.channel_id)
        .eq('org_id', session.org_id)
        .is('deleted_at', null)
        .maybeSingle(),
      'Unable to load class title',
    ) as { topic: string } | null;
    const scope = await resolveChannelLiveSessionScope({
      supabase: db,
      orgId: session.org_id,
      channelId: session.channel_id,
      strictClassTime: true,
      scheduleId:
        typeof session.app_metadata?.scheduleId === 'string'
          ? session.app_metadata.scheduleId
          : undefined,
      occurrenceKey: session.occurrence_key ?? undefined,
    });
    const window = classroomCallWindow(session, scope);
    return {
      window,
      db,
      session,
      represented,
      members,
      teacher,
      joined,
      title: channel?.topic || 'Classroom',
    };
  }
  async roster(token: string, id: string): Promise<ClassroomRosterVM> {
    const c = await this.context(token, id);
    const calls = checked(
      await c.db
        .from('classroom_call_invitations')
        .select('*')
        .eq('live_session_id', c.session.id)
        .gt('created_at', new Date(Date.now() - 60_000).toISOString())
        .order('created_at', { ascending: false }),
      'Unable to load call status',
    ) as Invitation[];
    const canCall = !!c.window && !!c.teacher && c.joined.has(c.teacher.id);
    return {
      enabled: true,
      ...(!c.window
        ? {
            callingUnavailableReason:
              'Calling is available only during the scheduled class time.',
          }
        : {}),
      canCall,
      members: c.members.map((p) => ({
        profileId: p.id,
        displayName:
          p.display_name?.trim() ||
          (p.kind === 'educator' ? 'Class teacher' : 'Class member'),
        kind: p.kind as 'educator' | 'guardian' | 'child',
        joined: c.joined.has(p.id),
        canCall: canCall && !c.joined.has(p.id) && p.id !== c.teacher?.id,
        ...(canCall && calls.find((call) => call.recipient_profile_id === p.id)
          ? {
              call: callView(
                calls.find((call) => call.recipient_profile_id === p.id)!,
                c.title,
                '',
              ),
            }
          : {}),
      })),
    };
  }
  async presence(
    token: string,
    id: string,
    connectionId: string,
    profileIds: string[],
    active: boolean,
  ) {
    const c = await this.context(token, id);
    const profiles = profileIds.length
      ? c.represented.profiles.filter((p) => profileIds.includes(p.id))
      : c.represented.profiles.filter(
          (p) =>
            c.represented.own.some((a) => a.id === p.account_id) &&
            c.members.some((m) => m.id === p.id),
        );
    if (
      !profiles.length ||
      profiles.some((p) => !c.members.some((m) => m.id === p.id)) ||
      (profileIds.length && profiles.length !== new Set(profileIds).size)
    )
      throw new ForbiddenException('Classroom identity required');
    if (active) {
      checked(
        await c.db.from('classroom_call_presence').upsert(
          profiles.map((p) => ({
            connection_id: connectionId,
            live_session_id: c.session.id,
            profile_id: p.id,
            last_seen_at: new Date().toISOString(),
          })),
        ),
        'Unable to update class presence',
      );
      checked(
        await c.db
          .from('classroom_call_invitations')
          .update({ status: 'accepted' })
          .eq('live_session_id', c.session.id)
          .in(
            'recipient_profile_id',
            profiles.map((p) => p.id),
          )
          .eq('status', 'ringing')
          .gt('expires_at', new Date().toISOString()),
        'Unable to update call status',
      );
    } else
      checked(
        await c.db
          .from('classroom_call_presence')
          .delete()
          .eq('connection_id', connectionId)
          .eq('live_session_id', c.session.id)
          .in(
            'profile_id',
            profiles.map((p) => p.id),
          ),
        'Unable to update class presence',
      );
    return { success: true };
  }
  async ring(token: string, id: string, profileId: string): Promise<ClassroomCallVM> {
    const c = await this.context(token, id);
    if (!c.window)
      throw new ForbiddenException(
        'Calling is available only during the scheduled class time.',
      );
    if (!c.teacher || !c.joined.has(c.teacher.id))
      throw new ForbiddenException('Join as the class teacher before calling');
    const target = c.members.find((p) => p.id === profileId);
    if (!target || target.id === c.teacher.id)
      throw new ForbiddenException('Call an enrolled class participant');
    if (c.joined.has(target.id))
      throw new ConflictException('This participant has already joined');
    const busy = checked(
      await c.db
        .from('classroom_call_presence')
        .select('profile_id')
        .eq('profile_id', target.id)
        .gt('last_seen_at', recent())
        .limit(1)
        .maybeSingle(),
      'Unable to check participant availability',
    );
    if (busy) throw new ConflictException('This participant is already in another class');
    const result = await c.db
      .rpc('create_classroom_call', {
        _session_id: c.session.id,
        _caller_id: c.teacher.id,
        _recipient_id: target.id,
        _window_end: c.window.endsAt,
      })
      .single();
    if (result.error?.code === 'P0002')
      throw new ForbiddenException(
        'Calling is available only during the scheduled class time.',
      );
    if (result.error?.code === 'P0001')
      throw new ConflictException('Please wait before calling this participant again');
    const invitation = checked(result, 'Unable to start class call') as Invitation;
    const links = checked(
      await c.db
        .from('family_links')
        .select('guardian_account_id')
        .eq('org_id', c.session.org_id)
        .eq('child_account_id', target.account_id)
        .is('deleted_at', null),
      'Unable to resolve call delivery',
    ) as { guardian_account_id: string }[];
    const recipients = await this.profiles(
      c.db,
      [target.account_id, ...links.map((l) => l.guardian_account_id)],
      c.session.org_id,
    );
    try {
      await Promise.all(
        recipients.map((p) =>
          sendPushNotification({
            orgId: c.session.org_id,
            recipientProfileId: p.id,
            prefKey: 'classroom.call',
            title: `${c.teacher!.display_name?.trim() || 'Your teacher'} is calling`,
            summary: `Join ${c.title}`,
            priority: 'high',
            call: { id: invitation.id, expiresAt: invitation.expires_at },
          }),
        ),
      );
    } catch {
      // Invitation remains available in the foreground; do not report delivery as successful.
      throw new InternalServerErrorException(
        'Call created, but the phone notification could not be sent. The participant can still receive it while the app is open.',
      );
    }
    return callView(
      invitation,
      c.title,
      c.teacher.display_name?.trim() || 'Your teacher',
    );
  }
  async incoming(token: string): Promise<ClassroomCallVM[]> {
    const db = this.db();
    const represented = await this.represented(db, token);
    if (!represented.profiles.length) return [];
    const enabled = await this.enabled(represented.profiles[0].id);
    if (!enabled) return [];
    const busy = checked(
      await db
        .from('classroom_call_presence')
        .select('profile_id')
        .in(
          'profile_id',
          represented.profiles.map((p) => p.id),
        )
        .gt('last_seen_at', recent())
        .limit(1)
        .maybeSingle(),
      'Unable to check your availability',
    );
    if (busy) return [];
    const calls = checked(
      await db
        .from('classroom_call_invitations')
        .select('*')
        .in(
          'recipient_profile_id',
          represented.profiles.map((p) => p.id),
        )
        .eq('status', 'ringing')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(10),
      'Unable to load incoming calls',
    ) as Invitation[];
    const result: ClassroomCallVM[] = [];
    for (const call of calls) {
      try {
        const c = await this.context(token, call.live_session_id);
        const caller = c.members.find(
          (p) => p.id === call.caller_profile_id && p.kind === 'educator',
        );
        if (
          c.window &&
          caller &&
          c.joined.has(caller.id) &&
          c.members.some((p) => p.id === call.recipient_profile_id) &&
          !c.joined.has(call.recipient_profile_id)
        )
          result.push({
            ...callView(call, c.title, caller.display_name?.trim() || 'Your teacher'),
            canJoin: true,
            messageAvailable: this.canMessage(c),
          });
      } catch (error) {
        if (!(error instanceof ForbiddenException || error instanceof NotFoundException))
          throw error;
      }
    }
    return result;
  }
  async respond(
    token: string,
    callId: string,
    action: 'accepted' | 'declined' | 'cancelled',
  ) {
    const db = this.db();
    const call = checked(
      await db
        .from('classroom_call_invitations')
        .select('*')
        .eq('id', callId)
        .maybeSingle(),
      'Unable to load class call',
    ) as Invitation | null;
    if (!call) throw new NotFoundException('Call not found');
    const c = await this.context(token, call.live_session_id);
    const allowed =
      action === 'cancelled'
        ? c.teacher?.id === call.caller_profile_id
        : c.represented.profiles.some((p) => p.id === call.recipient_profile_id);
    if (!allowed)
      throw new ForbiddenException('This invitation belongs to another participant');
    if (
      Date.parse(call.expires_at) <= Date.now() ||
      call.status !== 'ringing' ||
      !c.joined.has(call.caller_profile_id)
    )
      throw new ConflictException('This call is no longer ringing');
    if (action === 'accepted') {
      if (!c.window)
        throw new ForbiddenException(
          'Calling is available only during the scheduled class time.',
        );
      const busy = checked(
        await db
          .from('classroom_call_presence')
          .select('profile_id')
          .in(
            'profile_id',
            c.represented.profiles.map((p) => p.id),
          )
          .gt('last_seen_at', recent())
          .limit(1)
          .maybeSingle(),
        'Unable to check your availability',
      );
      if (busy) throw new ConflictException('Leave your current class before answering');
    }
    const updated = checked(
      await db
        .from('classroom_call_invitations')
        .update({ status: action })
        .eq('id', call.id)
        .eq('status', 'ringing')
        .gt('expires_at', new Date().toISOString())
        .select('id')
        .maybeSingle(),
      'Unable to update class call',
    );
    if (!updated) throw new ConflictException('This call has already been answered');
    return { sessionId: call.live_session_id };
  }
  private actorForMessage(c: Awaited<ReturnType<ClassroomCallsService['context']>>) {
    const own = c.represented.profiles.filter((p) =>
      c.represented.own.some((a) => a.id === p.account_id),
    );
    return (
      own.find((p) => p.kind === 'guardian') ??
      own.find((p) => ['child', 'educator'].includes(p.kind))
    );
  }
  private canMessage(c: Awaited<ReturnType<ClassroomCallsService['context']>>) {
    return !!this.actorForMessage(c);
  }
  private async recipientCall(token: string, id: string) {
    const db = this.db();
    const call = checked(
      await db.from('classroom_call_invitations').select('*').eq('id', id).maybeSingle(),
      'Unable to load class call',
    ) as Invitation | null;
    if (!call) throw new NotFoundException('Call not found');
    const c = await this.context(token, call.live_session_id, true);
    if (!c.represented.profiles.some((p) => p.id === call.recipient_profile_id))
      throw new ForbiddenException('This invitation belongs to another participant');
    const tutor = c.members.find(
      (p) => p.id === call.caller_profile_id && p.kind === 'educator',
    );
    return { ...c, call, tutor };
  }
  async detail(token: string, id: string): Promise<ClassroomCallVM> {
    const c = await this.recipientCall(token, id);
    const busy = checked(
      await c.db
        .from('classroom_call_presence')
        .select('profile_id')
        .in(
          'profile_id',
          c.represented.profiles.map((p) => p.id),
        )
        .gt('last_seen_at', recent())
        .limit(1)
        .maybeSingle(),
      'Unable to check your availability',
    );
    const inTime = c.session.status === 'live' && !!c.window;
    return {
      ...callView(c.call, c.title, c.tutor?.display_name?.trim() || 'Your tutor'),
      canJoin: inTime && !busy,
      ...(!inTime
        ? { joinUnavailableReason: 'The class is not currently in its scheduled time.' }
        : busy
          ? {
              joinUnavailableReason:
                'You are already in a class. Return to your current call to continue.',
            }
          : {}),
      messageAvailable: !!c.tutor && this.canMessage(c),
    };
  }
  async joinMissed(token: string, id: string) {
    const c = await this.recipientCall(token, id);
    if (!c.window || c.session.status !== 'live')
      throw new ForbiddenException('This class is outside its scheduled time.');
    const busy = checked(
      await c.db
        .from('classroom_call_presence')
        .select('profile_id')
        .in(
          'profile_id',
          c.represented.profiles.map((p) => p.id),
        )
        .gt('last_seen_at', recent())
        .limit(1)
        .maybeSingle(),
      'Unable to check your availability',
    );
    if (busy)
      throw new ConflictException(
        'You are already in a class. Return to your current call to continue.',
      );
    return { sessionId: c.session.id };
  }
  async messageTutor(token: string, id: string) {
    const c = await this.recipientCall(token, id);
    const actor = this.actorForMessage(c);
    if (!actor || !c.tutor || actor.id === c.tutor.id || !this.canMessage(c))
      throw new ForbiddenException('Messaging this tutor is not available');
    const dm = await this.channels.ensureDirectMessageChannel(
      token,
      {
        orgId: c.session.org_id,
        profileId: actor.id,
        otherProfileId: c.tutor.id,
      },
      { classroomCallId: c.call.id },
    );
    if (!dm) throw new ForbiddenException('Messaging this tutor is not available');
    checked(
      await c.db
        .from('classroom_call_invitations')
        .update({ status: 'declined' })
        .eq('id', c.call.id)
        .eq('status', 'ringing')
        .gt('expires_at', new Date().toISOString()),
      'Unable to dismiss class call',
    );
    const org = checked(
      await c.db
        .from('orgs')
        .select('slug')
        .eq('id', c.session.org_id)
        .is('deleted_at', null)
        .maybeSingle(),
      'Unable to open conversation',
    ) as { slug: string } | null;
    if (!org) throw new NotFoundException('Organization not found');
    return {
      nativePath: `/(app)/dm/${dm.channelId}`,
      webPath: `/${encodeURIComponent(org.slug)}/dm/${dm.channelId}`,
    };
  }
}
