import { describe, expect, it, vi } from 'vitest';
import type { ProfileRow } from '@iconicedu/shared-types';

const {
  getNotificationDefaultsMock,
  getNotificationScopedDefaultsMock,
  getPresenceMock,
  resolveProfileAvatarUrlMock,
} = vi.hoisted(() => ({
  getNotificationDefaultsMock: vi.fn(),
  getNotificationScopedDefaultsMock: vi.fn(),
  getPresenceMock: vi.fn(),
  resolveProfileAvatarUrlMock: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/profile/queries/notification-defaults.query', () => ({
  getNotificationDefaults: (...args: unknown[]) => getNotificationDefaultsMock(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/notification-scoped-defaults.query', () => ({
  getNotificationScopedDefaults: (...args: unknown[]) =>
    getNotificationScopedDefaultsMock(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/presence.query', () => ({
  getPresence: (...args: unknown[]) => getPresenceMock(...args),
}));

vi.mock('@iconicedu/web/lib/profile/avatar-url', () => ({
  resolveProfileAvatarUrl: (...args: unknown[]) => resolveProfileAvatarUrlMock(...args),
}));

import { buildUserProfileFromRow } from '@iconicedu/web/lib/profile/builders/user-profile.builder';

function makeProfileRow(): ProfileRow {
  return {
    id: 'profile-1',
    org_id: 'org-1',
    account_id: 'account-1',
    kind: 'system',
    display_name: 'Marc Fielding',
    first_name: 'Marc',
    last_name: 'Fielding',
    bio: null,
    avatar_source: 'seed',
    avatar_url: null,
    avatar_seed: 'profile-1',
    avatar_updated_at: null,
    timezone: 'America/New_York',
    locale: 'en-US',
    languages_spoken: null,
    status: 'active',
    country_code: 'US',
    country_name: 'United States',
    region: 'New York',
    city: 'New York',
    postal_code: '10314',
    notes_internal: null,
    lead_source: null,
    ui_theme_key: 'teal',
    created_at: '2026-01-01T00:00:00.000Z',
    created_by: null,
    updated_at: '2026-01-01T00:00:00.000Z',
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
  };
}

describe('buildUserProfileFromRow', () => {
  it('can skip notification preference loading for server admin previews', async () => {
    const supabase = {};
    getPresenceMock.mockResolvedValue({ data: null });
    resolveProfileAvatarUrlMock.mockResolvedValue(null);

    const profile = await buildUserProfileFromRow(supabase, makeProfileRow(), {
      includeNotificationPreferences: false,
    });

    expect(profile.prefs.notificationDefaults).toBeNull();
    expect(profile.prefs.notificationScopedDefaults).toBeNull();
    expect(getNotificationDefaultsMock).not.toHaveBeenCalled();
    expect(getNotificationScopedDefaultsMock).not.toHaveBeenCalled();
    expect(getPresenceMock).toHaveBeenCalledWith(supabase, 'org-1', 'profile-1');
  });
});
