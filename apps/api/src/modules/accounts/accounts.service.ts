import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';

@Injectable()
export class AccountsService {
  async me(accessToken: string) {
    const supabase = createSupabaseSessionClient(accessToken);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) throw new InternalServerErrorException(userError.message);
    if (!user) return null;

    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('auth_user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async linkAuth(accessToken: string, body: { email: string }) {
    const supabase = createSupabaseSessionClient(accessToken);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) throw new InternalServerErrorException(userError.message);

    const { data, error } = await supabase
      .from('accounts')
      .update({ auth_user_id: user?.id ?? null, updated_at: new Date().toISOString() })
      .eq('email', body.email)
      .select('*')
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async updateMe(
    accessToken: string,
    body: { phone?: string; onboardingCompletedAt?: string | null },
  ) {
    const supabase = createSupabaseSessionClient(accessToken);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) throw new InternalServerErrorException(userError.message);

    const { data, error } = await supabase
      .from('accounts')
      .update({
        phone: body.phone,
        onboarding_completed_at: body.onboardingCompletedAt ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('auth_user_id', user?.id ?? '')
      .select('*')
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async deleteMe(accessToken: string): Promise<{ deletedAt: string }> {
    const sessionSupabase = createSupabaseSessionClient(accessToken);
    const serviceSupabase = createSupabaseServiceClient();
    const {
      data: { user },
      error: userError,
    } = await sessionSupabase.auth.getUser();
    if (userError) throw new InternalServerErrorException(userError.message);
    if (!user) throw new NotFoundException('No authenticated user found');

    const { data: accounts, error: accountsError } = await serviceSupabase
      .from('accounts')
      .select('id')
      .eq('auth_user_id', user.id)
      .is('deleted_at', null);
    if (accountsError) throw new InternalServerErrorException(accountsError.message);

    const accountIds = (accounts ?? [])
      .map((account: { id?: string | null }) => account.id)
      .filter((id): id is string => Boolean(id));
    if (!accountIds.length) throw new NotFoundException('No linked account found');

    const deletedAt = new Date().toISOString();
    const { data: profiles, error: profilesError } = await serviceSupabase
      .from('profiles')
      .select('id')
      .in('account_id', accountIds)
      .is('deleted_at', null);
    if (profilesError) throw new InternalServerErrorException(profilesError.message);

    const profileIds = (profiles ?? [])
      .map((profile: { id?: string | null }) => profile.id)
      .filter((id): id is string => Boolean(id));

    if (profileIds.length) {
      const { error: pushTokenError } = await serviceSupabase
        .from('push_tokens')
        .delete()
        .in('profile_id', profileIds);
      if (pushTokenError) {
        throw new InternalServerErrorException(pushTokenError.message);
      }

      const { error: profileUpdateError } = await serviceSupabase
        .from('profiles')
        .update({
          display_name: 'Deleted user',
          first_name: null,
          last_name: null,
          bio: null,
          avatar_source: 'seed',
          avatar_url: null,
          avatar_seed: null,
          avatar_updated_at: null,
          locale: null,
          languages_spoken: null,
          status: 'deleted',
          country_code: null,
          country_name: null,
          region: null,
          city: null,
          postal_code: null,
          notes_internal: null,
          lead_source: null,
          deleted_at: deletedAt,
          updated_at: deletedAt,
        })
        .in('id', profileIds);
      if (profileUpdateError) {
        throw new InternalServerErrorException(profileUpdateError.message);
      }
    }

    const { error: accountUpdateError } = await serviceSupabase
      .from('accounts')
      .update({
        auth_user_id: null,
        email: null,
        phone_e164: null,
        whatsapp_e164: null,
        email_verified: false,
        email_verified_at: null,
        phone_verified: false,
        phone_verified_at: null,
        whatsapp_verified: false,
        whatsapp_verified_at: null,
        preferred_contact_channels: null,
        status: 'deleted',
        onboarding_completed_at: null,
        active_profile_id: null,
        deleted_at: deletedAt,
        updated_at: deletedAt,
      })
      .in('id', accountIds);
    if (accountUpdateError) {
      throw new InternalServerErrorException(accountUpdateError.message);
    }

    const { error: authDeleteError } = await serviceSupabase.auth.admin.deleteUser(
      user.id,
    );
    if (authDeleteError) {
      throw new InternalServerErrorException(authDeleteError.message);
    }

    return { deletedAt };
  }

  async activate(accessToken: string) {
    const supabase = createSupabaseSessionClient(accessToken);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) throw new InternalServerErrorException(userError.message);
    if (!user) return;

    const { error } = await supabase
      .from('accounts')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('auth_user_id', user.id);
    if (error) throw new InternalServerErrorException(error.message);
  }

  async byIds(accessToken: string, ids: string[]) {
    if (!ids.length) return [];
    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('accounts')
      .select(
        '*, profile:profiles!account_id(id, display_name, first_name, last_name, avatar_seed)',
      )
      .in('id', ids)
      .is('deleted_at', null);
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }
}
