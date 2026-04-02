import type { AccountRow } from '@iconicedu/shared-types';

export const WEB_INCOMPLETE_ONBOARDING_REAUTH_COOKIE = 'web_incomplete_onboarding_reauth';
export const WEB_INCOMPLETE_ONBOARDING_LOGIN_REASON = 'session-expired';

export interface WebAuthResumeGateInput {
  account: Pick<AccountRow, 'onboarding_completed_at'>;
  reauthCookieValue?: string | null;
}

export function shouldRedirectToAuthResume(input: WebAuthResumeGateInput): boolean {
  if (input.account.onboarding_completed_at) {
    return false;
  }

  return input.reauthCookieValue === '1';
}
