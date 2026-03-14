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

import { resolveGetStartedCallbackUrl } from './get-started-auth-client';

describe('resolveGetStartedCallbackUrl', () => {
  it('builds callback URL with get-started intent', () => {
    const callback = resolveGetStartedCallbackUrl();

    expect(callback).toBe('/auth/callback?intent=get-started&source=self-signup');
  });
});
