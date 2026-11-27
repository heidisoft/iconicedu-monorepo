import { beforeEach, expect, it, vi } from 'vitest';
import { POST } from './route';
const mocks = vi.hoisted(() => ({
  flag: vi.fn(),
  get: vi.fn(),
  entry: vi.fn(),
  cookie: vi.fn(),
}));
vi.mock('@iconicedu/web/lib/referrals/referral-entry-state', () => ({
  getReferralEntryState: mocks.entry,
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookie }) }));
vi.mock('@iconicedu/web/flags', () => ({ enableParentReferrals: mocks.flag }));
vi.mock('@iconicedu/web/lib/api/http-client', () => ({
  createPublicApiClient: () => ({ get: mocks.get }),
}));
const code = 'a'.repeat(48);
const url = `https://academy.example.invalid/r/${code}/continue`;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.flag.mockResolvedValue(true);
  mocks.entry.mockResolvedValue('guest');
  mocks.get.mockResolvedValue({ orgSlug: 'test-academy', referrerName: 'Test Parent' });
});
it('sets first-party HttpOnly attribution and sends the recipient to web signup', async () => {
  const response = await POST(
    new Request(url, {
      method: 'POST',
      headers: { origin: 'https://academy.example.invalid' },
    }),
    { params: Promise.resolve({ code }) },
  );
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe(
    'https://academy.example.invalid/test-academy/get-started',
  );
  expect(response.headers.get('set-cookie')).toContain(`iconic-parent-referral=${code}`);
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  expect(response.headers.get('set-cookie')).toContain('SameSite=lax');
  expect(response.headers.get('cache-control')).toBe('no-store');
});
it('rejects cross-origin attribution changes', async () => {
  const response = await POST(
    new Request(url, {
      method: 'POST',
      headers: { origin: 'https://other.example.invalid' },
    }),
    { params: Promise.resolve({ code }) },
  );
  expect(response.status).toBe(403);
  expect(mocks.get).not.toHaveBeenCalled();
});
it('is unavailable while the flag is off', async () => {
  mocks.flag.mockResolvedValue(false);
  const response = await POST(new Request(url, { method: 'POST' }), {
    params: Promise.resolve({ code }),
  });
  expect(response.status).toBe(404);
  expect(mocks.get).not.toHaveBeenCalled();
});
it('does not redirect using an untrusted organization slug', async () => {
  mocks.get.mockResolvedValue({ orgSlug: '//evil.example.invalid' });
  const response = await POST(
    new Request(url, {
      method: 'POST',
      headers: { origin: 'https://academy.example.invalid' },
    }),
    { params: Promise.resolve({ code }) },
  );
  expect(response.status).toBe(404);
});

it.each(['signed_in', 'unavailable'])(
  'does not set attribution or redirect when entry is %s',
  async (state) => {
    mocks.entry.mockResolvedValue(state);
    const response = await POST(
      new Request(url, {
        method: 'POST',
        headers: { origin: 'https://academy.example.invalid' },
      }),
      { params: Promise.resolve({ code }) },
    );
    expect(response.status).toBe(state === 'signed_in' ? 403 : 503);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(mocks.get).not.toHaveBeenCalled();
  },
);
