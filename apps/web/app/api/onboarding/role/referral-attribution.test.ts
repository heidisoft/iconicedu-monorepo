import { ApiHttpError } from '@iconicedu/web/lib/api/http-client';
import { NextResponse } from 'next/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { POST } from './route';
const mocks = vi.hoisted(() => ({
  flag: vi.fn(),
  getCookie: vi.fn(),
  proxy: vi.fn(),
  resolve: vi.fn(),
}));
vi.mock('@iconicedu/web/lib/api/http-client', () => ({
  createPublicApiClient: () => ({ get: mocks.resolve }),
  ApiHttpError: class extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.getCookie }) }));
vi.mock('@iconicedu/web/flags', () => ({ enableParentReferrals: mocks.flag }));
vi.mock('@iconicedu/web/app/api/_lib/proxy-to-api', () => ({
  proxyPostToApi: mocks.proxy,
}));
const code = 'a'.repeat(48);
function request(body: unknown) {
  return new Request('https://academy.example.invalid/api/onboarding/role', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      origin: 'https://academy.example.invalid',
    },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolve.mockResolvedValue({
    orgSlug: 'test-academy',
    referrerName: 'Test Parent',
  });
  mocks.flag.mockResolvedValue(true);
  mocks.getCookie.mockReturnValue({ value: code });
  mocks.proxy.mockImplementation(async () => NextResponse.json({ success: true }));
});
it('attaches the first-party referral code and clears it after successful onboarding', async () => {
  const response = await POST(request({ role: 'parent', referrerName: 'Test Parent' }));
  expect(await mocks.proxy.mock.calls[0]![0].json()).toMatchObject({
    role: 'parent',
    referralCode: code,
  });
  expect(response.headers.get('set-cookie')).toContain('iconic-parent-referral=');
});
it('strips all referral input while the flag is off', async () => {
  mocks.flag.mockResolvedValue(false);
  await POST(
    request({ role: 'parent', referralCode: code, referrerName: 'Test Parent' }),
  );
  expect(await mocks.proxy.mock.calls[0]![0].json()).toEqual({ role: 'parent' });
});
it('honors an explicit removal of attribution', async () => {
  await POST(request({ role: 'parent', skipReferral: true }));
  expect(await mocks.proxy.mock.calls[0]![0].json()).not.toHaveProperty('referralCode');
});
it('preserves callback attribution across browser changes when no cookie is present', async () => {
  mocks.getCookie.mockReturnValue(undefined);
  await POST(request({ role: 'parent', referralCode: code }));
  expect(await mocks.proxy.mock.calls[0]![0].json()).toMatchObject({
    referralCode: code,
  });
});
it('does not apply parent referral data to other roles', async () => {
  await POST(
    request({ role: 'educator', referralCode: code, referrerName: 'Test Parent' }),
  );
  expect(await mocks.proxy.mock.calls[0]![0].json()).toEqual({ role: 'educator' });
});
it('retains the referral cookie if onboarding fails', async () => {
  mocks.proxy.mockImplementationOnce(async () =>
    NextResponse.json({ success: false }, { status: 400 }),
  );
  const response = await POST(request({ role: 'parent' }));
  expect(response.status).toBe(400);
  expect(response.headers.get('set-cookie')).toBeNull();
});

it('lets onboarding continue without a deactivated referral instead of trapping signup', async () => {
  mocks.resolve.mockRejectedValueOnce(new ApiHttpError(404, 'Unavailable'));
  await POST(request({ role: 'parent' }));
  expect(await mocks.proxy.mock.calls[0]![0].json()).not.toHaveProperty('referralCode');
});
it('preserves attribution for retry when the referral service is temporarily unavailable', async () => {
  mocks.resolve.mockRejectedValueOnce(new ApiHttpError(503, 'Unavailable'));
  const response = await POST(request({ role: 'parent' }));
  expect(response.status).toBe(503);
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(mocks.proxy).not.toHaveBeenCalled();
});
