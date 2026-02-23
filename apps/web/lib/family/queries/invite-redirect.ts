import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

export function resolveFamilyInviteRedirectUrl(orgSlug: string): string {
  const base = resolveAppUrl().replace(/\/$/, '');
  const params = new URLSearchParams({
    org: orgSlug,
    intent: 'get-started',
  });
  return `${base}/auth/callback?${params.toString()}`;
}
