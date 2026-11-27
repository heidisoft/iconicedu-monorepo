import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ cookie: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookie }) }));
import { POST } from './route';
const code = 'a'.repeat(48);
function request(origin = 'https://academy.example.invalid') {
  return new Request('https://academy.example.invalid/api/referrals/cancel', {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}
beforeEach(() => mocks.cookie.mockReturnValue({ value: code }));
it('clears the matching HttpOnly attribution and prevents stale callback restoration', async () => {
  const response = await POST(request());
  expect(response.status).toBe(204);
  const cookie = response.headers.get('set-cookie')!;
  expect(cookie).toContain('iconic-parent-referral=;');
  expect(cookie).toContain(`iconic-parent-referral-cancelled=${code}`);
  expect(cookie).toContain('HttpOnly');
});
it('rejects cross-origin cancellation', async () => {
  expect((await POST(request('https://other.example.invalid'))).status).toBe(403);
});
it('does not remove a different newly accepted invitation', async () => {
  mocks.cookie.mockReturnValue({ value: 'b'.repeat(48) });
  const response = await POST(request());
  expect(response.headers.get('set-cookie')).not.toContain('iconic-parent-referral=;');
});
