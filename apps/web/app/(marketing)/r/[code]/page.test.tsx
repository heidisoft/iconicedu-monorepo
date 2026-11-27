import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import Page from './page';
const mocks = vi.hoisted(() => ({ flag: vi.fn(), get: vi.fn(), entry: vi.fn() }));
vi.mock('@iconicedu/web/lib/referrals/referral-entry-state', () => ({
  getReferralEntryState: mocks.entry,
}));
vi.mock('@iconicedu/web/flags', () => ({ enableParentReferrals: mocks.flag }));
vi.mock('@iconicedu/web/lib/api/http-client', () => ({
  createPublicApiClient: () => ({ get: mocks.get }),
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
const code = 'a'.repeat(48);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.flag.mockResolvedValue(true);
  mocks.entry.mockResolvedValue('guest');
  mocks.get.mockResolvedValue({
    referrerName: 'Test Parent',
    orgSlug: 'test-academy',
    rewardLabel: '$20 off',
  });
});
it('explains the new parent benefits and keeps the referrer reward secondary', async () => {
  render(await Page({ params: Promise.resolve({ code }) }));
  expect(screen.getByText(/Test Parent invited you/)).toBeTruthy();
  expect(screen.getByText(/without installing an app/)).toBeTruthy();
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
    'Join families learning with ICONIC Academy.',
  );
  expect(screen.getByText('Explore classes for your child.')).toBeTruthy();
  expect(
    screen.getByText('Manage your children’s profiles and see their upcoming sessions.'),
  ).toBeTruthy();
  expect(
    screen.getByText(/As a thank-you for introducing your family/).textContent,
  ).toContain('$20 off');
  expect(screen.getByRole('link', { name: 'Open app and continue' })).toHaveAttribute(
    'href',
    `iconicedu://r/${code}`,
  );
  expect(
    screen.getByRole('link', { name: 'Download on the App Store' }).getAttribute('href'),
  ).not.toContain('/us/');
  const form = screen
    .getByRole('button', { name: /Continue on the web/ })
    .closest('form');
  expect(form).toHaveAttribute('action', `/r/${code}/continue`);
  expect(form).toHaveAttribute('method', 'post');
});
it('does not resolve links while the web flag is off', async () => {
  mocks.flag.mockResolvedValue(false);
  await expect(Page({ params: Promise.resolve({ code }) })).rejects.toThrow(
    'NEXT_NOT_FOUND',
  );
  expect(mocks.get).not.toHaveBeenCalled();
});
it('shows no invitation for an invalid link', async () => {
  await expect(
    Page({ params: Promise.resolve({ code: '../../admin' }) }),
  ).rejects.toThrow('NEXT_NOT_FOUND');
  expect(mocks.get).not.toHaveBeenCalled();
});

it('shows no invitation acceptance or app handoff for a signed-in account', async () => {
  mocks.entry.mockResolvedValue('signed_in');
  render(await Page({ params: Promise.resolve({ code }) }));
  expect(
    screen.getByRole('heading', { name: 'Invitations are for new parents' }),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Continue on the web' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Open app and continue' })).toBeNull();
  expect(mocks.get).not.toHaveBeenCalled();
});
