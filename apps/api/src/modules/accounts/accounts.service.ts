import { Injectable, InternalServerErrorException } from '@nestjs/common';
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
