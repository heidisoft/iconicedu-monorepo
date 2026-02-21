import { metadata as loginMetadata } from '@iconicedu/web/app/(auth)/login/page';
import { metadata as tutorLoginMetadata } from '@iconicedu/web/app/(auth)/login/tutor/page';

describe('login metadata', () => {
  it('defines metadata for the default login page', () => {
    expect(loginMetadata.title).toBe('Login | ICONIC Academy');
    expect(loginMetadata.description).toContain('ICONIC Academy');
    expect(loginMetadata.robots).toEqual({ index: false, follow: false });
  });

  it('defines metadata for the tutor login page', () => {
    expect(tutorLoginMetadata.title).toBe('Educator Login | ICONIC Academy');
    expect(tutorLoginMetadata.description).toContain('educator');
    expect(tutorLoginMetadata.robots).toEqual({ index: false, follow: false });
  });
});
