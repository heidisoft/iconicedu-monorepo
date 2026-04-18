import { apiGet, apiPost } from '@/lib/api/http-client';

export async function activateAccount(): Promise<void> {
  await apiPost('/accounts/activate', {});
}

export async function fetchUserAccount() {
  return apiGet('/accounts/me');
}

export async function fetchProfile(profileId: string) {
  return apiGet(`/profiles/${profileId}`);
}

export async function fetchProfileByAccountId(accountId: string) {
  return apiGet('/profiles/active-for-account', { accountId });
}

export async function fetchProfilesForAccount(accountId: string, orgId?: string) {
  const rows = await apiGet<Array<Record<string, unknown>>>('/profiles/by-account', {
    accountId,
  });
  return orgId
    ? rows.filter((row) => (row.org_id as string | undefined) === orgId)
    : rows;
}

export async function fetchAccountsByIds(accountIds: string[]) {
  if (!accountIds.length) return [];
  return apiGet<Array<Record<string, unknown>>>('/accounts/by-ids', {
    ids: accountIds.join(','),
  });
}
