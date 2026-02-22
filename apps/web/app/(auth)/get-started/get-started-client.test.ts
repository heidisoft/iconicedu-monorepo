import { shouldSyncSlugFromName } from '@iconicedu/web/app/(auth)/get-started/get-started-client';
import { normalizeOrgSlug } from '@iconicedu/web/lib/org/slug';

describe('get-started slug behavior', () => {
  it('auto-generates slug from org name while slug is not manually edited', () => {
    expect(shouldSyncSlugFromName(false, '')).toBe(true);
    expect(normalizeOrgSlug('ICONIC Academy')).toBe('iconic-academy');
  });

  it('keeps manual slug edits when name changes', () => {
    expect(shouldSyncSlugFromName(true, 'my-custom-slug')).toBe(false);
  });

  it('resumes auto-generation after manual slug is cleared', () => {
    expect(shouldSyncSlugFromName(true, '')).toBe(true);
  });
});
