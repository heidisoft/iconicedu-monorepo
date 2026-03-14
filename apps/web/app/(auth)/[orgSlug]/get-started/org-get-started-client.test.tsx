import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@iconicedu/web/app/(auth)/shared/auth-entry-form', () => ({
  AuthEntryForm: () => null,
}));

vi.mock('@iconicedu/web/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      signInWithOtp: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
  })),
}));

vi.mock('@iconicedu/web/lib/telemetry/auth-events', () => ({
  trackAuthTelemetry: vi.fn(),
}));

vi.mock('@iconicedu/web/app/(auth)/shared/code-entry-utils', () => ({
  buildCodeEntryPath: vi.fn(),
  shouldCreateUserForIntent: vi.fn(() => true),
}));

import { resolveOrgGetStartedCallbackUrl } from './org-get-started-client';

describe('resolveOrgGetStartedCallbackUrl', () => {
  it('builds callback URL with org + get-started intent', () => {
    const callback = resolveOrgGetStartedCallbackUrl('iconic-academy');
    const expected =
      typeof window === 'undefined'
        ? '/auth/callback?intent=get-started&source=self-signup'
        : `${window.location.origin}/auth/callback?org=iconic-academy&intent=get-started&source=self-signup`;

    expect(callback).toBe(expected);
  });
});
