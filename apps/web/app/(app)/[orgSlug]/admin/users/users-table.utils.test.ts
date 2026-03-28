import { describe, expect, it } from 'vitest';

import {
  buildAdminUserDmPath,
  groupUsersByFamily,
} from '@iconicedu/web/app/(app)/[orgSlug]/admin/users/users-table.utils';

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

describe('groupUsersByFamily', () => {
  it('nests linked child rows under guardian rows', () => {
    const grouped = groupUsersByFamily([
      {
        id: 'guardian-1',
        orgId: 'org-1',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        lastSeenAt: '2026-01-01T00:00:00.000Z',
        profileKind: 'guardian',
        displayName: 'Parent One',
        linkedChildAccountIds: ['child-1'],
        linkedGuardianAccountIds: [],
      },
      {
        id: 'child-1',
        orgId: 'org-1',
        status: 'active',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        lastSeenAt: '2026-01-02T00:00:00.000Z',
        profileKind: 'child',
        displayName: 'Student One',
        linkedChildAccountIds: [],
        linkedGuardianAccountIds: ['guardian-1'],
      },
      {
        id: 'staff-1',
        orgId: 'org-1',
        status: 'active',
        createdAt: '2026-01-03T00:00:00.000Z',
        updatedAt: '2026-01-03T00:00:00.000Z',
        lastSeenAt: '2026-01-03T00:00:00.000Z',
        profileKind: 'staff',
        displayName: 'Staff One',
        linkedChildAccountIds: [],
        linkedGuardianAccountIds: [],
      },
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0].row.id).toBe('guardian-1');
    expect(grouped[0].children.map((child) => child.id)).toEqual(['child-1']);
    expect(grouped[1].row.id).toBe('staff-1');
  });

  it('keeps unlinked child rows at the top level', () => {
    const grouped = groupUsersByFamily([
      {
        id: 'child-2',
        orgId: 'org-1',
        status: 'active',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        lastSeenAt: '2026-01-02T00:00:00.000Z',
        profileKind: 'child',
        displayName: 'Student Two',
        linkedChildAccountIds: [],
        linkedGuardianAccountIds: [],
      },
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].row.id).toBe('child-2');
    expect(grouped[0].children).toEqual([]);
  });
});
