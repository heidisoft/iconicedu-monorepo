import { metadata as loginMetadata } from '@iconicedu/web/app/(auth)/login/page';

describe('login metadata', () => {
  it('defines metadata for the default login page', () => {
    expect(loginMetadata.title).toBe('Get Started | ICONIC Academy');
    expect(loginMetadata.description).toContain('Admin-first');
    expect(loginMetadata.robots).toEqual({ index: false, follow: false });
  });
});
