import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

const ADMIN_ROLE_KEYS = ['owner', 'admin', 'staff'];

/**
 * Resolves the caller's account in the org and asserts it holds an
 * owner/admin/staff role. Mirrors the check used across admin query services.
 */
export async function requireAdminAccount(
  authUserId: string,
  orgId: string,
): Promise<{ accountId: string }> {
  const supabase = createSupabaseServiceClient();

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id')
    .eq('auth_user_id', authUserId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();

  if (accountError) throw new InternalServerErrorException(accountError.message);
  if (!account) throw new ForbiddenException('Not a member of this organization');

  const { data: roles, error: rolesError } = await supabase
    .from('user_roles')
    .select('role_key')
    .eq('account_id', account.id)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .returns<Array<{ role_key: string | null }>>();

  if (rolesError) throw new InternalServerErrorException(rolesError.message);

  const isAdmin = (roles ?? []).some(
    (role) => role.role_key != null && ADMIN_ROLE_KEYS.includes(role.role_key),
  );
  if (!isAdmin) throw new ForbiddenException('Forbidden');

  return { accountId: account.id };
}
