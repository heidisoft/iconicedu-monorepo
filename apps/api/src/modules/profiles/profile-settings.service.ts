import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type {
  ProfileSettingsInput,
  ProfileSettingsSectionInput,
} from '@iconicedu/shared-types';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import {
  normalizeProfileSettings,
  normalizeProfileSettingsSection,
} from './profile-settings';

@Injectable()
export class ProfileSettingsService {
  private handleError(error: { code?: string; message: string }) {
    if (error.code === '42501')
      throw new ForbiddenException('You do not have permission to change this profile.');
    if (error.code === '23503')
      throw new ConflictException(
        'This child has class assignments or other guardians. Open Account → Live Support and provide the child’s name and class details to request removal.',
      );
    throw new InternalServerErrorException(
      'Unable to save profile changes. Please try again.',
    );
  }

  async get(token: string, id: string) {
    const { data, error } = await createSupabaseSessionClient(token).rpc(
      'get_profile_settings',
      { target_id: id },
    );
    if (error) this.handleError(error);
    return data;
  }

  async save(
    token: string,
    id: string,
    body: ProfileSettingsInput | ProfileSettingsSectionInput,
  ) {
    const isSection = body && typeof body === 'object' && 'section' in body;
    const values = isSection
      ? normalizeProfileSettingsSection(body)
      : normalizeProfileSettings(body);
    const avatarUrl = isSection
      ? body.section === 'appearance' || body.section === 'photo'
        ? body.values.avatarUrl
        : undefined
      : body.avatarUrl;
    if (avatarUrl !== undefined) {
      const { data: profile, error } = await createSupabaseSessionClient(token)
        .from('profiles')
        .select('org_id')
        .eq('id', id)
        .single();
      if (error || !profile) throw new ForbiddenException();
      const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
      const prefix = `${base}/storage/v1/object/public/public-avatars/${profile.org_id}/${id}/`;
      if (
        typeof avatarUrl !== 'string' ||
        !base ||
        !avatarUrl.startsWith(prefix) ||
        !/^[a-zA-Z0-9-]+\.jpg$/.test(avatarUrl.slice(prefix.length))
      )
        throw new BadRequestException('Invalid profile photo.');
      values.avatar_url = avatarUrl;
      values.avatar_source = 'upload';
      values.avatar_updated_at = new Date().toISOString();
    }
    const session = createSupabaseSessionClient(token);
    const {
      data: { user },
      error: authError,
    } = await session.auth.getUser();
    if (authError || !user) throw new ForbiddenException();
    const { data: actor, error: actorError } = await session
      .from('accounts')
      .select('id')
      .eq('auth_user_id', user.id)
      .is('deleted_at', null)
      .single();
    if (actorError || !actor) throw new ForbiddenException();
    const { data, error } = await createSupabaseServiceClient().rpc(
      'save_profile_settings',
      { target_id: id, changes: values, actor_id: actor.id },
    );
    if (error) this.handleError(error);
    return data;
  }

  async remove(token: string, id: string) {
    const { error } = await createSupabaseSessionClient(token).rpc(
      'remove_family_child',
      { target_id: id },
    );
    if (error) this.handleError(error);
    return { success: true };
  }
}
