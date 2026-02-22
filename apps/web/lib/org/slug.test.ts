import { describe, expect, it } from 'vitest';

import { normalizeOrgSlug, ORG_SLUG_REGEX } from '@iconicedu/web/lib/org/slug';

describe('org slug utils', () => {
  it('normalizes user-entered slug text', () => {
    expect(normalizeOrgSlug(' My New Org ')).toBe('my-new-org');
    expect(normalizeOrgSlug('ICONIC__Academy')).toBe('iconic-academy');
    expect(normalizeOrgSlug('---hello---')).toBe('hello');
  });

  it('accepts normalized slug format', () => {
    expect(ORG_SLUG_REGEX.test('iconic-academy')).toBe(true);
    expect(ORG_SLUG_REGEX.test('Iconic Academy')).toBe(false);
  });
});
