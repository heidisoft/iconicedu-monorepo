import { describe, expect, it } from 'vitest';

import { getAdminUserPreviewTabs } from './admin-user-profile-preview.utils';

describe('getAdminUserPreviewTabs', () => {
  it('returns account only when no profile is present', () => {
    expect(getAdminUserPreviewTabs(null)).toEqual(['account', 'metadata']);
  });

  it('returns guardian tabs', () => {
    expect(
      getAdminUserPreviewTabs({
        kind: 'guardian',
        ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
        profile: { displayName: 'Jamie M', avatar: { source: 'seed' } },
        prefs: {},
        meta: {
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        joinedDate: '2026-01-01T00:00:00.000Z',
      }),
    ).toEqual([
      'account',
      'metadata',
      'profile',
      'preferences',
      'location',
      'notifications',
      'family',
    ]);
  });

  it('adds educator-specific tabs when availability exists', () => {
    expect(
      getAdminUserPreviewTabs({
        kind: 'educator',
        ids: { id: 'profile-2', orgId: 'org-1', accountId: 'account-2' },
        profile: { displayName: 'Priya', avatar: { source: 'seed' } },
        prefs: {},
        meta: {
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        joinedDate: '2026-01-01T00:00:00.000Z',
        availability: {
          classTypes: ['1:1'],
          weeklyCommitment: 10,
          availability: null,
        },
      }),
    ).toEqual([
      'account',
      'metadata',
      'profile',
      'preferences',
      'location',
      'notifications',
      'educator-profile',
      'educator-availability',
    ]);
  });
});
