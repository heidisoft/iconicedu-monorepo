import type { AvatarSource, ThemeKey, UserProfileVM, UserRoleVM } from '@iconicedu/shared-types';
import type { RoleKey } from '@iconicedu/shared-types';

import { THEME_KEY_SET } from '@iconicedu/web/lib/profile/constants/theme';

export function deriveDisplayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): string {
  const fullName =
    typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : null;
  if (fullName?.trim()) {
    return fullName.trim();
  }
  if (user.email) {
    return user.email.split('@')[0];
  }
  return 'New user';
}

export function resolveExternalAvatarUrl(user: {
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}): string | null {
  const provider = user.app_metadata?.provider;
  if (provider !== 'google') {
    return null;
  }

  const avatarUrl =
    (typeof user.user_metadata?.avatar_url === 'string'
      ? user.user_metadata.avatar_url
      : null) ??
    (typeof user.user_metadata?.picture === 'string'
      ? user.user_metadata.picture
      : null);

  return avatarUrl && avatarUrl.trim() ? avatarUrl.trim() : null;
}

export function deriveProfileKind(userRoles: UserRoleVM[]): UserProfileVM['kind'] {
  const rolePriority: RoleKey[] = [
    'guardian',
    'educator',
    'staff',
    'child',
    'admin',
    'owner',
  ];
  const roleKey =
    rolePriority.find((candidate) =>
      userRoles.some((role) => role.roleKey === candidate),
    ) ?? null;

  if (roleKey === 'educator') return 'educator';
  if (roleKey === 'child') return 'child';
  if (roleKey === 'staff') return 'staff';
  if (roleKey === 'admin' || roleKey === 'owner') return 'staff';
  if (roleKey === 'guardian') return 'guardian';
  return 'system';
}

export function profileKindFromRoleKey(
  roleKey: RoleKey | null | undefined,
): UserProfileVM['kind'] {
  if (roleKey === 'educator') return 'educator';
  if (roleKey === 'child') return 'child';
  if (roleKey === 'staff' || roleKey === 'admin' || roleKey === 'owner') {
    return 'staff';
  }
  if (roleKey === 'guardian') return 'guardian';
  return 'system';
}

export function resolveAvatarSource(value: string | null): AvatarSource {
  if (value === 'upload' || value === 'external' || value === 'seed') {
    return value;
  }
  return 'seed';
}

export function resolveThemeKey(value: string | null): ThemeKey | null {
  if (value && THEME_KEY_SET.has(value as ThemeKey)) {
    return value as ThemeKey;
  }
  return null;
}
