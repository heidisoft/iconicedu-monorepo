import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import Page from './page';
const mocks = vi.hoisted(() => ({ flag: vi.fn(), cookie: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: mocks.cookie }),
  headers: async () => new Headers(),
}));
vi.mock('@iconicedu/web/flags', () => ({
  enableParentReferrals: mocks.flag,
  enableMobileGoogleSignIn: async () => false,
  enableMobileAppleSignIn: async () => false,
}));
vi.mock('@iconicedu/web/lib/org/builders/org.builder', () => ({
  buildOrgBySlug: async () => ({
    id: 'org-1',
    slug: 'test-academy',
    name: 'Test Academy',
  }),
}));
vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: () => ({}),
}));
vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));
vi.mock('@iconicedu/web/lib/mobile/detect-mobile', () => ({
  isMobileOrTablet: () => true,
}));
vi.mock('@iconicedu/web/app/(auth)/shared/mobile-app-prompt', () => ({
  MobileAppPrompt: ({ defaultVisible }: { defaultVisible: boolean }) =>
    defaultVisible ? <div>Install app prompt</div> : null,
}));
vi.mock('@iconicedu/web/app/(auth)/[orgSlug]/get-started/org-get-started-client', () => ({
  default: ({ initialReferralCode }: { initialReferralCode?: string }) => (
    <div data-testid="signup" data-referral={initialReferralCode}>
      Web signup
    </div>
  ),
}));
const code = 'a'.repeat(48);
beforeEach(() => {
  mocks.flag.mockResolvedValue(true);
  mocks.cookie.mockReturnValue({ value: code });
});
it('keeps referred mobile visitors on web signup and carries their attribution into authentication', async () => {
  render(
    await Page({
      params: Promise.resolve({ orgSlug: 'test-academy' }),
      searchParams: Promise.resolve({}),
    }),
  );
  expect(screen.queryByText('Install app prompt')).toBeNull();
  expect(screen.getByTestId('signup')).toHaveAttribute('data-referral', code);
});
it('preserves the existing signup behavior when referrals are off', async () => {
  mocks.flag.mockResolvedValue(false);
  render(
    await Page({
      params: Promise.resolve({ orgSlug: 'test-academy' }),
      searchParams: Promise.resolve({}),
    }),
  );
  expect(screen.getByText('Install app prompt')).toBeTruthy();
  expect(screen.getByTestId('signup')).not.toHaveAttribute('data-referral');
});
