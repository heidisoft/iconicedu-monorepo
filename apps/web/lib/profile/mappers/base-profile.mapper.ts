import type {
  NotificationDefaultsVM,
  PresenceVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import type { ProfileRow } from '@iconicedu/shared-types';

import { resolveAvatarSource, resolveThemeKey } from '@iconicedu/web/lib/profile/derive';

function formatDisplayName(input: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
}): string {
  const display = input.displayName?.trim() ?? '';
  if (display) {
    return display;
  }
  const first = input.firstName?.trim() ?? '';
  const last = input.lastName?.trim() ?? '';
  if (first && last) {
    return `${first} ${last.charAt(0).toUpperCase()}.`;
  }
  if (first) {
    return first;
  }
  return '';
}

export function mapBaseProfile(
  profileRow: ProfileRow,
  input: {
    notificationDefaults: NotificationDefaultsVM | null;
    presence: PresenceVM | null;
    avatarUrlOverride?: string | null;
    accountEmail?: string | null;
  },
): Omit<UserProfileVM, 'kind'> {
  return {
    ids: {
      id: profileRow.id,
      orgId: profileRow.org_id,
      accountId: profileRow.account_id,
    },
    profile: {
      displayName: formatDisplayName({
        firstName: profileRow.first_name,
        lastName: profileRow.last_name,
        displayName: profileRow.display_name,
      }),
      email: input.accountEmail ?? null,
      firstName: profileRow.first_name,
      lastName: profileRow.last_name,
      bio: profileRow.bio,
      avatar: {
        source: resolveAvatarSource(profileRow.avatar_source),
        url: input.avatarUrlOverride ?? profileRow.avatar_url,
        seed: profileRow.avatar_seed,
        updatedAt: profileRow.avatar_updated_at,
      },
    },
    prefs: {
      timezone: profileRow.timezone ?? 'UTC',
      locale: profileRow.locale,
      languagesSpoken: profileRow.languages_spoken,
      notificationDefaults: input.notificationDefaults,
    },
    presence: input.presence,
    status: profileRow.status ?? undefined,
    accountEmail: input.accountEmail ?? null,
    location: {
      countryCode: profileRow.country_code,
      countryName: profileRow.country_name,
      region: profileRow.region,
      city: profileRow.city,
      postalCode: profileRow.postal_code,
    },
    internal: {
      notesInternal: profileRow.notes_internal,
      leadSource: profileRow.lead_source,
    },
    meta: {
      createdAt: profileRow.created_at,
      updatedAt: profileRow.updated_at,
    },
    ui: {
      themeKey: resolveThemeKey(profileRow.ui_theme_key),
    },
  };
}
