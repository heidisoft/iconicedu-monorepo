import { metadata as loginMetadata } from '@iconicedu/web/app/(auth)/login/page';

describe('login metadata', () => {
  it('defines metadata for the default login page', () => {
    expect(loginMetadata.title).toBe('Login | ICONIC Academy');
    expect(loginMetadata.description).toContain('ICONIC Academy');
    expect(loginMetadata.robots).toEqual({ index: false, follow: false });
  });
});
