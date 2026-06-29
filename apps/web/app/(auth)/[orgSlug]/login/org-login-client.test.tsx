// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  default as OrgLoginClient,
  resolveOrgLoginCallbackUrl,
  shouldPromptOrgSignUp,
} from './org-login-client';

const authEntryFormPropsMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

vi.mock('../../shared/auth-entry-form', () => ({
  AuthEntryForm: (props: Record<string, unknown>) => {
    authEntryFormPropsMock(props);
    return <div data-testid="auth-entry-form" />;
  },
}));

vi.mock('../../../../lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      signInWithOtp: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
  }),
}));

describe('resolveOrgLoginCallbackUrl', () => {
  it('builds callback URL with org + login intent', () => {
    const callback = resolveOrgLoginCallbackUrl('iconic-academy');

    expect(callback).toBe(
      `${window.location.origin}/auth/callback?org=iconic-academy&intent=login`,
    );
  });
});

describe('shouldPromptOrgSignUp', () => {
  it('returns true for missing account reason', () => {
    expect(
      shouldPromptOrgSignUp({
        eligible: false,
        reason: 'missing_account',
      }),
    ).toBe(true);
  });

  it('returns false for suspended reason', () => {
    expect(
      shouldPromptOrgSignUp({
        eligible: false,
        reason: 'suspended',
      }),
    ).toBe(false);
  });

  it('returns true when sign-up is required first', () => {
    expect(
      shouldPromptOrgSignUp({
        eligible: false,
        reason: 'signup_required',
      }),
    ).toBe(true);
  });
});

describe('OrgLoginClient', () => {
  beforeEach(() => {
    authEntryFormPropsMock.mockClear();
  });

  it('renders a sign up link to the org get started page', () => {
    render(<OrgLoginClient orgSlug="iconic-academy" orgName="ICONIC Academy" />);

    expect(screen.getByTestId('auth-entry-form')).toBeTruthy();
    expect(authEntryFormPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        footerLinkIntro: 'New to ICONIC Academy?',
        footerLinkLabel: 'Get started here',
        footerLinkHref: '/iconic-academy/get-started',
      }),
    );
  });

  it('passes the updated login page copy to the auth entry form', () => {
    render(<OrgLoginClient orgSlug="iconic-academy" orgName="ICONIC Academy" />);

    expect(authEntryFormPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'One place for lessons, schedules, and progress.',
        subtitle:
          "No password needed. We'll email you a secure one-time code to sign in.",
        submitLabel: 'Continue',
        submitLoadingLabel: 'Sending code...',
        featureBullets: [
          'Qualified, vetted tutors',
          'Schedules, sessions & homework in one place',
          'Real-time messages, updates & payments',
        ],
      }),
    );
  });

  it('renders the session expiry guidance when provided', () => {
    render(
      <OrgLoginClient
        orgSlug="iconic-academy"
        orgName="ICONIC Academy"
        loginReason="session-expired"
      />,
    );

    expect(authEntryFormPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subtitle:
          'Your session expired because onboarding was not completed. Sign in again to continue setup.',
      }),
    );
  });
});
