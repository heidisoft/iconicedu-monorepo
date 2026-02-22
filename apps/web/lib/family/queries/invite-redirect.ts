import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

export function resolveFamilyInviteRedirectUrl(): string {
  return `${resolveAppUrl()}/auth/callback`;
}
