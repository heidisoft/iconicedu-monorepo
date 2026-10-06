import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  DEFAULT_LIVE_SESSION_SETTINGS,
  platformFeatureFlagKeys,
  type ClassroomMeetingSettingsVM,
} from '@iconicedu/shared-types';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { loadAndAuthorizeProfile } from '@iconicedu/api/lib/actor/resolve-actor-profile';
import { evaluateApiBooleanFlag } from '@iconicedu/api/lib/flags/posthog-openfeature';
import { parseLiveSessionSettings } from './live-session-settings';

type Context = { orgId: string; profileId: string };
export type SaveClassroomMeetingSettings = Context & {
  classroomId: string;
  settings: unknown;
};

@Injectable()
export class ClassroomMeetingSettingsService {
  async authorize(accessToken: string, context: Context) {
    const supabase = createSupabaseServiceClient();
    const { profile, account } = await loadAndAuthorizeProfile({
      serviceSupabase: supabase,
      sessionSupabase: createSupabaseSessionClient(accessToken),
      ...context,
    });
    const roles = await supabase
      .from('user_roles')
      .select('role_key')
      .eq('org_id', context.orgId)
      .eq('account_id', account.id)
      .is('deleted_at', null);
    if (roles.error)
      throw new InternalServerErrorException('Unable to verify meeting settings access');
    if (!roles.data?.some((role) => ['owner', 'admin', 'staff'].includes(role.role_key)))
      throw new ForbiddenException('Classroom manager access required');
    // Guardian delegation must never lend a manager account's permissions to a child.
    const user = await createSupabaseSessionClient(accessToken).auth.getUser();
    const ownAccount = await supabase
      .from('accounts')
      .select('id')
      .eq('org_id', context.orgId)
      .eq('auth_user_id', user.data.user?.id ?? '')
      .is('deleted_at', null)
      .maybeSingle();
    if (ownAccount.error || ownAccount.data?.id !== profile.account_id)
      throw new ForbiddenException('Classroom manager access required');
    return { supabase, profile };
  }

  async get(
    accessToken: string,
    orgSlug: string,
    classroomId?: string,
  ): Promise<ClassroomMeetingSettingsVM> {
    const supabase = createSupabaseServiceClient();
    const user = await createSupabaseSessionClient(accessToken).auth.getUser();
    if (!user.data.user) throw new ForbiddenException('Unauthorized');
    const org = await supabase
      .from('orgs')
      .select('id')
      .eq('slug', orgSlug)
      .is('deleted_at', null)
      .maybeSingle();
    if (org.error || !org.data) throw new NotFoundException('Organization not found');
    const account = await supabase
      .from('accounts')
      .select('id')
      .eq('org_id', org.data.id)
      .eq('auth_user_id', user.data.user.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (account.error || !account.data) throw new ForbiddenException('Unauthorized');
    const profile = await supabase
      .from('profiles')
      .select('id')
      .eq('org_id', org.data.id)
      .eq('account_id', account.data.id)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    if (profile.error || !profile.data)
      throw new ForbiddenException('Classroom manager access required');
    await this.authorize(accessToken, { orgId: org.data.id, profileId: profile.data.id });
    const enabled = await evaluateApiBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableClassroomMeetingSettings,
      distinctId: profile.data.id,
    });
    if (!enabled || !classroomId)
      return { enabled, settings: structuredClone(DEFAULT_LIVE_SESSION_SETTINGS) };
    const channel = await this.channel(supabase, org.data.id, classroomId);
    const stored = channel.live_session_config as Record<string, unknown> | null;
    return {
      enabled,
      settings: stored?.settings
        ? parseLiveSessionSettings(stored.settings)
        : structuredClone(DEFAULT_LIVE_SESSION_SETTINGS),
    };
  }

  async save(accessToken: string, input: SaveClassroomMeetingSettings) {
    const settings = parseLiveSessionSettings(input.settings);
    const { supabase } = await this.authorize(accessToken, input);
    const enabled = await evaluateApiBooleanFlag({
      flagKey: platformFeatureFlagKeys.enableClassroomMeetingSettings,
      distinctId: input.profileId,
    });
    if (!enabled)
      throw new ForbiddenException('Classroom meeting settings are not enabled');
    const channel = await this.channel(supabase, input.orgId, input.classroomId);
    const config = channel.live_session_config as Record<string, unknown> | null;
    if (!config?.enabled || config.provider !== 'zoom')
      throw new BadRequestException('Meeting options require an enabled Zoom meeting');
    const result = await supabase
      .from('channels')
      .update({
        live_session_config: { ...config, settings, settingsProfileId: input.profileId },
        updated_at: new Date().toISOString(),
        updated_by: input.profileId,
      })
      .eq('org_id', input.orgId)
      .eq('id', channel.id)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    if (result.error || !result.data)
      throw new InternalServerErrorException('Unable to save meeting settings');
    return { enabled: true, settings };
  }

  private async channel(
    supabase: ReturnType<typeof createSupabaseServiceClient>,
    orgId: string,
    classroomId: string,
  ) {
    const response = await supabase
      .from('channels')
      .select('id, live_session_config')
      .eq('org_id', orgId)
      .eq('primary_entity_id', classroomId)
      .eq('primary_entity_kind', 'learning_space')
      .is('deleted_at', null)
      .maybeSingle();
    if (response.error)
      throw new InternalServerErrorException('Unable to load Classroom meeting settings');
    if (!response.data) throw new NotFoundException('Classroom channel not found');
    return response.data;
  }
}
