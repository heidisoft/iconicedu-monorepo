import { resolveOrgGetStartedCallbackUrl } from '@iconicedu/web/app/(auth)/[orgSlug]/get-started/org-get-started-client';

describe('resolveOrgGetStartedCallbackUrl', () => {
  it('builds callback URL with org + get-started intent', () => {
    const callback = resolveOrgGetStartedCallbackUrl('iconic-academy');

    expect(callback).toBe(`${window.location.origin}/auth/callback?org=iconic-academy&intent=get-started`);
  });
});
