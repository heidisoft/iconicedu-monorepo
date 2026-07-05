import React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authEntryFormPropsMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@iconicedu/web/app/(auth)/shared/auth-entry-form', () => ({
  AuthEntryForm: (props: Record<string, unknown>) => {
    authEntryFormPropsMock(props);
    return <div data-testid="auth-entry-form" />;
  },
}));

vi.mock('@iconicedu/web/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      signInWithOtp: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
  })),
}));

vi.mock('@iconicedu/web/app/(auth)/shared/code-entry-utils', () => ({
  buildCodeEntryPath: vi.fn(),
  shouldCreateUserForIntent: vi.fn(() => true),
}));

import OrgGetStartedClient, {
  resolveOrgGetStartedCallbackUrl,
} from './org-get-started-client';

beforeEach(() => {
  authEntryFormPropsMock.mockClear();
});

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

describe('OrgGetStartedClient', () => {
  it('passes the mobile-aligned sign-up copy to the auth entry form', () => {
    render(<OrgGetStartedClient orgSlug="iconic-academy" orgName="ICONIC Academy" />);

    expect(authEntryFormPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Personalized tutoring for every child',
        subtitle:
          'Book trusted 1-on-1 academic support that helps students build skills, confidence, and future readiness.',
        submitLabel: 'Get Started',
        submitLoadingLabel: 'Sending...',
        oauthActionVerb: 'sign-up',
        trustLine: 'Create your account to get started with ICONIC Academy.',
      }),
    );
  });
});
