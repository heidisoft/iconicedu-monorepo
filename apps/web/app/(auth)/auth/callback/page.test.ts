import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@iconicedu/web/app/(auth)/auth/callback/callback-run-guard', () => ({
  shouldSkipCallbackRun: vi.fn(() => false),
}));

vi.mock('@iconicedu/web/app/(auth)/auth/callback/role-onboarding-modal', () => ({
  RoleOnboardingModal: () => null,
}));

vi.mock('@iconicedu/web/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: vi.fn(),
      setSession: vi.fn(),
      verifyOtp: vi.fn(),
      getUser: vi.fn(),
    },
  })),
}));

import { shouldShowRoleOnboardingDialog } from './page.utils';

describe('shouldShowRoleOnboardingDialog', () => {
  it('shows the dialog for self sign-up onboarding only', () => {
    expect(
      shouldShowRoleOnboardingDialog({
        authIntent: 'get-started',
        callbackSource: 'self-signup',
        requiresRoleSelection: true,
      }),
    ).toBe(true);
  });

  it('does not show the dialog for non self-sign-up get-started callbacks', () => {
    expect(
      shouldShowRoleOnboardingDialog({
        authIntent: 'get-started',
        callbackSource: null,
        requiresRoleSelection: true,
      }),
    ).toBe(false);
  });

  it('does not show the dialog for login flows', () => {
    expect(
      shouldShowRoleOnboardingDialog({
        authIntent: 'login',
        callbackSource: 'self-signup',
        requiresRoleSelection: true,
      }),
    ).toBe(false);
  });
});
