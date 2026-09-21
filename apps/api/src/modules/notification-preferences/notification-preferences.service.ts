import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { getNotificationPolicyConfig } from '@iconicedu/api/lib/notifications/policy-config';
import { resolveEffectivePreference } from '@iconicedu/api/lib/notifications/resolve-effective-preference';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';

/**
 * A "per-conversation" control (issue #264 capability 12) is meant to govern
 * every message-shaped notification for that channel/learning-space, not one
 * narrow pref_key — each event type otherwise resolves its own independent
 * pref_key (see policy-config.ts), so setting a conversation's mode fans out
 * to all of these.
 */
const CONVERSATION_MESSAGE_PREF_KEYS = [
  'message.posted',
  'message.mentioned',
  'message.thread_reply.posted',
  'message.unviewed_intended_participants',
  'file.uploaded',
  'image.uploaded',
  'audio.uploaded',
  'reaction.added',
] as const;

@Injectable()
export class NotificationPreferencesService {
  private readonly signupDefaultPreferences = [
    { prefKey: 'message.posted', channels: ['push', 'email'] },
    { prefKey: 'message.mentioned', channels: ['push', 'email'] },
    { prefKey: 'message.unviewed_intended_participants', channels: ['push', 'email'] },
    { prefKey: 'message.thread_reply.posted', channels: ['push', 'email'] },
    { prefKey: 'file.uploaded', channels: ['push', 'email'] },
    { prefKey: 'image.uploaded', channels: ['push', 'email'] },
    { prefKey: 'audio.uploaded', channels: ['push', 'email'] },
    { prefKey: 'reaction.added', channels: ['push', 'email'] },
    { prefKey: 'class.schedule.created', channels: ['push', 'email'] },
    { prefKey: 'class.schedule.ended', channels: ['push', 'email'] },
    { prefKey: 'class.session.rescheduled', channels: ['push', 'email'] },
    { prefKey: 'class.session.canceled', channels: ['push', 'email'] },
    { prefKey: 'session.reminder.sent', channels: ['push'] },
    { prefKey: 'session.feedback_request.sent', channels: ['email'] },
    { prefKey: 'session.completion_check.sent', channels: ['email'] },
    { prefKey: 'session.completion.dispute_reported', channels: ['push', 'email'] },
  ] as const;

  private normalizeChannels(channels: string[]) {
    return channels
      .map((channel) => (channel === 'text' ? 'sms' : channel))
      .filter((channel) => ['push', 'email', 'sms', 'whatsapp'].includes(channel));
  }

  private isScopeKind(value: unknown): value is 'channel' | 'learning_space' {
    return value === 'channel' || value === 'learning_space';
  }

  private async requireOrgActor(accessToken: string, orgId: string) {
    const sessionSupabase = createSupabaseSessionClient(accessToken);
    const {
      data: { user },
      error: userError,
    } = await sessionSupabase.auth.getUser();

    if (userError) {
      throw new UnauthorizedException(userError.message);
    }
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    const serviceSupabase = createSupabaseServiceClient();
    const { data: account, error: accountError } = await serviceSupabase
      .from('accounts')
      .select('id, org_id, primary_role, active_profile_id')
      .eq('auth_user_id', user.id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle<{
        id: string;
        org_id: string;
        primary_role: string | null;
        active_profile_id: string | null;
      }>();

    if (accountError) {
      throw new InternalServerErrorException(accountError.message);
    }
    if (!account) {
      throw new ForbiddenException('Forbidden');
    }

    return { user, account, serviceSupabase };
  }

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

  async listScopes(
    accessToken: string,
    input: {
      orgId: string;
      profileId: string;
      scopeKind?: string;
      scopeId?: string;
    },
  ) {
    const supabase = createSupabaseSessionClient(accessToken);
    let query = supabase
      .from('notification_preference_scopes')
      .select('*')
      .eq('org_id', input.orgId)
      .eq('profile_id', input.profileId)
      .is('deleted_at', null);

    if (input.scopeKind && this.isScopeKind(input.scopeKind)) {
      query = query.eq('scope_kind', input.scopeKind);
    }
    if (input.scopeId) {
      query = query.eq('scope_id', input.scopeId);
    }

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    return (
      data?.map((row) => ({
        id: row.id,
        orgId: row.org_id,
        profileId: row.profile_id,
        scopeKind: row.scope_kind,
        scopeId: row.scope_id,
        prefKey: row.pref_key,
        channels: row.channels ?? [],
        muted: row.muted ?? null,
        mode: row.mode ?? 'normal',
        mutedUntil: row.muted_until ?? null,
      })) ?? []
    );
  }

  async upsertScope(
    accessToken: string,
    body: {
      orgId: string;
      profileId: string;
      prefKey: string;
      channels: string[];
      muted?: boolean | null;
      mode?: 'normal' | 'mentions_only' | 'muted_until' | 'muted_until_enabled';
      mutedUntil?: string | null;
      scopeKind: string;
      scopeId: string;
    },
  ) {
    if (!this.isScopeKind(body.scopeKind)) {
      throw new ForbiddenException('Invalid scopeKind.');
    }
    if (body.mode === 'muted_until' && !body.mutedUntil) {
      throw new ForbiddenException('mutedUntil is required when mode is muted_until.');
    }

    const { account, serviceSupabase } = await this.requireOrgActor(
      accessToken,
      body.orgId,
    );
    const channels = this.normalizeChannels(body.channels);
    const mode = body.mode ?? 'normal';
    // Keep the legacy boolean in sync for any reader that only understands it.
    const derivedMuted =
      mode === 'muted_until_enabled' ||
      (mode === 'muted_until' &&
        Boolean(body.mutedUntil) &&
        new Date(body.mutedUntil as string).getTime() > Date.now());
    const now = new Date().toISOString();
    const { data, error } = await serviceSupabase
      .from('notification_preference_scopes')
      .upsert(
        {
          org_id: body.orgId,
          profile_id: body.profileId,
          scope_kind: body.scopeKind,
          scope_id: body.scopeId,
          pref_key: body.prefKey,
          channels,
          mode,
          muted_until: mode === 'muted_until' ? body.mutedUntil : null,
          muted:
            typeof body.muted === 'boolean'
              ? body.muted
              : derivedMuted || (channels.length === 0 ? true : null),
          updated_at: now,
          updated_by: account.active_profile_id ?? account.id,
          deleted_at: null,
          deleted_by: null,
        },
        { onConflict: 'org_id,profile_id,scope_kind,scope_id,pref_key' },
      )
      .select('*')
      .single<{
        id: string;
        org_id: string;
        profile_id: string;
        scope_kind: 'channel' | 'learning_space';
        scope_id: string;
        pref_key: string;
        channels: string[];
        muted?: boolean | null;
        mode?: string | null;
        muted_until?: string | null;
      }>();

    if (error) throw new InternalServerErrorException(error.message);
    return {
      success: true,
      data: {
        id: data.id,
        orgId: data.org_id,
        profileId: data.profile_id,
        scopeKind: data.scope_kind,
        scopeId: data.scope_id,
        prefKey: data.pref_key,
        channels: this.normalizeChannels(data.channels ?? []),
        muted: data.muted ?? null,
        mode: data.mode ?? 'normal',
        mutedUntil: data.muted_until ?? null,
      },
    };
  }

  /** Sets the conversation-wide notification mode across every message-shaped pref_key for this scope. */
  async setConversationMode(
    accessToken: string,
    body: {
      orgId: string;
      profileId: string;
      scopeKind: string;
      scopeId: string;
      mode: 'normal' | 'mentions_only' | 'muted_until' | 'muted_until_enabled';
      mutedUntil?: string | null;
    },
  ) {
    if (!this.isScopeKind(body.scopeKind)) {
      throw new ForbiddenException('Invalid scopeKind.');
    }
    if (body.mode === 'muted_until' && !body.mutedUntil) {
      throw new ForbiddenException('mutedUntil is required when mode is muted_until.');
    }

    const { serviceSupabase } = await this.requireOrgActor(accessToken, body.orgId);
    const existingResponse = await serviceSupabase
      .from('notification_preference_scopes')
      .select('pref_key, channels')
      .eq('org_id', body.orgId)
      .eq('profile_id', body.profileId)
      .eq('scope_kind', body.scopeKind)
      .eq('scope_id', body.scopeId)
      .in('pref_key', CONVERSATION_MESSAGE_PREF_KEYS)
      .is('deleted_at', null);
    if (existingResponse.error) {
      throw new InternalServerErrorException(existingResponse.error.message);
    }
    const existingChannelsByPrefKey = new Map(
      (existingResponse.data ?? []).map((row) => [
        row.pref_key as string,
        (row.channels as string[] | null) ?? [],
      ]),
    );

    await Promise.all(
      CONVERSATION_MESSAGE_PREF_KEYS.map((prefKey) =>
        this.upsertScope(accessToken, {
          orgId: body.orgId,
          profileId: body.profileId,
          prefKey,
          channels: existingChannelsByPrefKey.get(prefKey) ?? ['push'],
          mode: body.mode,
          mutedUntil: body.mutedUntil,
          scopeKind: body.scopeKind,
          scopeId: body.scopeId,
        }),
      ),
    );

    return { success: true };
  }

  /** Reads the conversation-wide mode from the first message pref_key row that has one set. */
  async getConversationMode(
    accessToken: string,
    input: { orgId: string; profileId: string; scopeKind: string; scopeId: string },
  ) {
    if (!this.isScopeKind(input.scopeKind)) {
      throw new ForbiddenException('Invalid scopeKind.');
    }

    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('notification_preference_scopes')
      .select('mode, muted_until')
      .eq('org_id', input.orgId)
      .eq('profile_id', input.profileId)
      .eq('scope_kind', input.scopeKind)
      .eq('scope_id', input.scopeId)
      .eq('pref_key', 'message.posted')
      .is('deleted_at', null)
      .maybeSingle<{ mode: string | null; muted_until: string | null }>();
    if (error) throw new InternalServerErrorException(error.message);

    return {
      mode:
        (data?.mode as
          | 'normal'
          | 'mentions_only'
          | 'muted_until'
          | 'muted_until_enabled'
          | null) ?? 'normal',
      mutedUntil: data?.muted_until ?? null,
    };
  }

  async deleteScope(
    accessToken: string,
    body: {
      orgId: string;
      profileId: string;
      prefKey: string;
      scopeKind: string;
      scopeId: string;
    },
  ) {
    if (!this.isScopeKind(body.scopeKind)) {
      throw new ForbiddenException('Invalid scopeKind.');
    }

    const { serviceSupabase } = await this.requireOrgActor(accessToken, body.orgId);
    const { error } = await serviceSupabase
      .from('notification_preference_scopes')
      .delete()
      .eq('org_id', body.orgId)
      .eq('profile_id', body.profileId)
      .eq('scope_kind', body.scopeKind)
      .eq('scope_id', body.scopeId)
      .eq('pref_key', body.prefKey);

    if (error) throw new InternalServerErrorException(error.message);
    return { success: true };
  }

  async effective(
    accessToken: string,
    body: {
      orgId: string;
      profileId: string;
      prefKey: string;
      scopeKind?: string;
      scopeId?: string;
    },
  ) {
    await this.requireOrgActor(accessToken, body.orgId);
    const supabase = createSupabaseSessionClient(accessToken);

    const scope =
      body.scopeKind === 'channel' && body.scopeId
        ? { kind: 'channel' as const, channelId: body.scopeId }
        : body.scopeKind === 'learning_space' && body.scopeId
          ? { kind: 'learning_space' as const, learningSpaceId: body.scopeId }
          : { kind: 'global' as const };

    const decision = await resolveEffectivePreference({
      supabase: supabase as never,
      event: {
        id: 'effective-preview-event-id',
        org_id: body.orgId,
        event_type: body.prefKey,
        occurred_at: new Date().toISOString(),
        source_kind: 'system',
        actor_profile_id: null,
        scope,
        object_ref: null,
        target_ref: null,
        payload: {},
        audience_rules: [],
        dedupe_key: null,
        projection_status: 'pending',
        projection_attempts: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      recipientProfileId: body.profileId,
      defaultChannels: ['push', 'email'],
    });

    return {
      success: true,
      data: {
        prefKey: body.prefKey,
        source: decision.source,
        muted: decision.muted,
        channels: decision.channels,
        scopeKind: decision.scopeKind,
        scopeId: decision.scopeId,
        policy: getNotificationPolicyConfig(body.prefKey),
      },
    };
  }

  async seedDefaults(accessToken: string, body: { orgId: string; profileId: string }) {
    const { account, serviceSupabase } = await this.requireOrgActor(
      accessToken,
      body.orgId,
    );
    const existingResponse = await serviceSupabase
      .from('notification_preferences')
      .select('id')
      .eq('org_id', body.orgId)
      .eq('profile_id', body.profileId)
      .is('deleted_at', null)
      .limit(1);

    if (existingResponse.error) {
      throw new InternalServerErrorException(existingResponse.error.message);
    }
    if ((existingResponse.data ?? []).length > 0) {
      return { success: true, seeded: false };
    }

    const now = new Date().toISOString();
    const rows = this.signupDefaultPreferences.map((item) => ({
      org_id: body.orgId,
      profile_id: body.profileId,
      pref_key: item.prefKey,
      channels: [...item.channels],
      muted: false,
      created_at: now,
      updated_at: now,
      updated_by: account.active_profile_id ?? account.id,
    }));

    const { error } = await serviceSupabase
      .from('notification_preferences')
      .upsert(rows, { onConflict: 'org_id,profile_id,pref_key' });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return { success: true, seeded: true };
  }
}
