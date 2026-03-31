import type { UserProfileVM } from '@iconicedu/shared-types';

export type AdminUserPreviewTab =
  | 'account'
  | 'metadata'
  | 'profile'
  | 'preferences'
  | 'location'
  | 'notifications'
  | 'family'
  | 'student-profile'
  | 'educator-profile'
  | 'educator-availability'
  | 'staff-profile';

export function getAdminUserPreviewTabs(
  profile?: UserProfileVM | null,
): AdminUserPreviewTab[] {
  const tabs: AdminUserPreviewTab[] = ['account'];

  tabs.push('metadata');

  if (!profile) {
    return tabs;
  }

  tabs.push('profile', 'preferences', 'location', 'notifications');

  if (profile.kind === 'guardian' || profile.kind === 'child') {
    tabs.push('family');
  }

  if (profile.kind === 'child') {
    tabs.push('student-profile');
  }

  if (profile.kind === 'educator') {
    tabs.push('educator-profile');
    if (profile.availability) {
      tabs.push('educator-availability');
    }
  }

  if (profile.kind === 'staff') {
    tabs.push('staff-profile');
  }

  return tabs;
}
