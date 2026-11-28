import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ user: vi.fn() }));
vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: mocks.user } }),
}));
import { getReferralEntryState } from './referral-entry-state';
beforeEach(() => vi.clearAllMocks());
it('allows an unauthenticated visitor', async () => {
  mocks.user.mockResolvedValue({ data: { user: null }, error: null });
  expect(await getReferralEntryState()).toBe('guest');
});
it('allows the normal missing-session response', async () => {
  mocks.user.mockResolvedValue({
    data: { user: null },
    error: { name: 'AuthSessionMissingError' },
  });
  expect(await getReferralEntryState()).toBe('guest');
});
it('blocks any signed-in user before resolving an invitation', async () => {
  mocks.user.mockResolvedValue({ data: { user: { id: 'existing' } }, error: null });
  expect(await getReferralEntryState()).toBe('signed_in');
});
it('fails closed when authentication cannot be checked', async () => {
  mocks.user.mockResolvedValue({
    data: { user: null },
    error: { name: 'AuthRetryableFetchError' },
  });
  expect(await getReferralEntryState()).toBe('unavailable');
});
