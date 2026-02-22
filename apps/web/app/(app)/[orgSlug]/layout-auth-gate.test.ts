import { describe, expect, it } from 'vitest';

import { shouldRedirectToAuthResume } from '@iconicedu/web/app/(app)/[orgSlug]/layout-auth-gate';

describe('shouldRedirectToAuthResume', () => {
  it('does not redirect when role status is unassigned', () => {
    expect(
      shouldRedirectToAuthResume({
        role_status: 'unassigned',
      } as never),
    ).toBe(false);
  });

  it('does not redirect when role status is active', () => {
    expect(
      shouldRedirectToAuthResume({
        role_status: 'active',
      } as never),
    ).toBe(false);
  });

  it('does not redirect when role status is null', () => {
    expect(
      shouldRedirectToAuthResume({
        role_status: null,
      } as never),
    ).toBe(false);
  });
});
