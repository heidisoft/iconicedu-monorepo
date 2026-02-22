import { resolveGetStartedCallbackUrl } from '@iconicedu/web/app/(auth)/get-started/get-started-auth-client';

describe('resolveGetStartedCallbackUrl', () => {
  it('builds callback URL with get-started intent', () => {
    const callback = resolveGetStartedCallbackUrl();

    expect(callback).toBe(`${window.location.origin}/auth/callback?intent=get-started`);
  });
});
