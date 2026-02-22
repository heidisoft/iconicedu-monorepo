import { metadata } from '@iconicedu/web/app/(auth)/[orgSlug]/login/page';

describe('org login metadata', () => {
  it('sets noindex metadata', () => {
    expect(metadata.title).toBe('Organization Login | ICONIC Academy');
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
