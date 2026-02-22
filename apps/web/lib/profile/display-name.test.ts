import { describe, expect, it } from 'vitest';

import { buildChildDisplayName } from '@iconicedu/web/lib/profile/display-name';

describe('buildChildDisplayName', () => {
  it('formats display name with first name and last initial', () => {
    expect(buildChildDisplayName('Maya', 'Johnson')).toBe('Maya J');
  });

  it('returns first name when last name is empty', () => {
    expect(buildChildDisplayName('Maya', '')).toBe('Maya');
  });

  it('returns empty string when first name is empty', () => {
    expect(buildChildDisplayName('', 'Johnson')).toBe('');
  });
});
