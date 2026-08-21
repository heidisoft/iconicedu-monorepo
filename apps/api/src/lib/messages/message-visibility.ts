import type { RawMessageRow } from '@iconicedu/shared-types';

/**
 * Enforce profile-targeted message visibility before rows leave the API boundary.
 */
export function filterVisibleMessageRows<T extends RawMessageRow>(
  rows: T[],
  currentProfileId = '',
): T[] {
  return rows.filter((row) => {
    if (row.visibility_type !== 'specific-users') return true;
    if (!currentProfileId) return false;
    return (row.visibility_user_ids ?? []).includes(currentProfileId);
  });
}
