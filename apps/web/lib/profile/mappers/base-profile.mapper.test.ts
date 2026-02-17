import { describe, expect, it } from 'vitest';
import type { ProfileRow } from '@iconicedu/shared-types';

import { mapBaseProfile } from '@iconicedu/web/lib/profile/mappers/base-profile.mapper';

const baseProfileRow: ProfileRow = {
  id: 'profile-1',
  org_id: 'org-1',
  account_id: 'account-1',
  kind: 'staff',
  display_name: 'Sara Parras',
  first_name: null,
  last_name: null,
  bio: null,
  avatar_source: 'seed',
  avatar_url: null,
  avatar_seed: null,
  avatar_updated_at: null,
  timezone: 'UTC',
  locale: 'en-US',
  languages_spoken: null,
  status: 'active',
  country_code: null,
  country_name: null,
  region: null,
  city: null,
  postal_code: null,
  notes_internal: null,
  lead_source: null,
  ui_theme_key: null,
  created_at: '2026-01-01T00:00:00.000Z',
  created_by: null,
  updated_at: '2026-01-01T00:00:00.000Z',
  updated_by: null,
  deleted_at: null,
  deleted_by: null,
};

describe('mapBaseProfile', () => {
  it('uses display_name unchanged when available', () => {
    const vm = mapBaseProfile(
      {
        ...baseProfileRow,
        first_name: 'Sara',
        last_name: 'Parras',
      },
      {
        notificationDefaults: null,
        presence: null,
      },
    );

    expect(vm.profile.displayName).toBe('Sara Parras');
  });

  it('falls back to first name + last initial when display_name is missing', () => {
    const vm = mapBaseProfile(
      {
        ...baseProfileRow,
        display_name: null,
        first_name: 'Maya',
        last_name: 'Johnson',
      },
      {
        notificationDefaults: null,
        presence: null,
      },
    );

    expect(vm.profile.displayName).toBe('Maya J.');
  });

  it('falls back to first name when only first name exists', () => {
    const vm = mapBaseProfile(
      {
        ...baseProfileRow,
        display_name: null,
        first_name: 'Kai',
        last_name: null,
      },
      {
        notificationDefaults: null,
        presence: null,
      },
    );

    expect(vm.profile.displayName).toBe('Kai');
  });

  it('returns empty string when all name fields are missing', () => {
    const vm = mapBaseProfile(
      {
        ...baseProfileRow,
        display_name: null,
        first_name: null,
        last_name: null,
      },
      {
        notificationDefaults: null,
        presence: null,
      },
    );

    expect(vm.profile.displayName).toBe('');
  });
});
