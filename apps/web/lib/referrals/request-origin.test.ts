import { expect, it } from 'vitest';
import { referralRequestOrigin } from './request-origin';
it('uses the browser Host for local aliases instead of the internal Next URL', () => {
  expect(
    referralRequestOrigin(
      new Request('http://localhost:3000/api/referrals/cancel', {
        headers: { host: '127.0.0.1:3000' },
      }),
    ),
  ).toBe('http://127.0.0.1:3000');
});
it('ignores a malformed host and forwarded host headers', () => {
  expect(
    referralRequestOrigin(
      new Request('https://www.iconicedu.com/api/referrals/cancel', {
        headers: { host: 'evil.test/path', 'x-forwarded-host': 'evil.test' },
      }),
    ),
  ).toBe('https://www.iconicedu.com');
});
