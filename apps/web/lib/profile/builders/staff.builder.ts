import type { StaffProfileVM, UserProfileVM } from '@iconicedu/shared-types';
import type { ProfileRow } from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getStaffProfile, getStaffSpecialties } from '@iconicedu/web/lib/profile/queries/staff.query';

function normalizePermissionsScope(
  raw: string | null | undefined,
): StaffProfileVM['permissionsScope'] {
  if (raw === 'limited' || raw === 'standard' || raw === 'elevated') {
    return raw;
  }
  return null;
}

export async function buildStaffProfile(
  supabase: SupabaseClient,
  baseProfile: Omit<UserProfileVM, 'kind'>,
  profileRow: ProfileRow,
): Promise<StaffProfileVM> {
  const [staff, specialties] = await Promise.all([
    getStaffProfile(supabase, profileRow.id),
    getStaffSpecialties(supabase, profileRow.id),
  ]);

  return {
    ...baseProfile,
    kind: 'staff',
    department: staff.data?.department ?? null,
    managerStaffId: staff.data?.manager_staff_id ?? null,
    jobTitle: staff.data?.job_title ?? null,
    permissionsScope: normalizePermissionsScope(staff.data?.permissions_scope),
    specialties: specialties.data?.map((row) => row.specialty) ?? null,
    weeklyAvailability: staff.data?.weekly_availability ?? null,
  };
}
