import { describe, expect, it } from 'vitest';

import { buildAdminUserDmPath } from '@iconicedu/web/app/(app)/[orgSlug]/admin/users/users-table.utils';

describe('buildAdminUserDmPath', () => {
  it('builds an org-scoped direct-message path with encoded profile id', () => {
    expect(buildAdminUserDmPath('iconic-academy', 'profile-123')).toBe(
      '/iconic-academy/dm?id=profile-123',
    );
    expect(buildAdminUserDmPath('iconic-academy', 'profile/abc+1')).toBe(
      '/iconic-academy/dm?id=profile%2Fabc%2B1',
    );
  });
});
