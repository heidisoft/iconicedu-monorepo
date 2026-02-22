import { metadata } from '@iconicedu/web/app/(auth)/[orgSlug]/get-started/page';

describe('org get-started metadata', () => {
  it('sets noindex metadata', () => {
    expect(metadata.title).toBe('Get Started | ICONIC Academy');
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
