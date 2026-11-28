import type { RawMessageRow } from '@iconicedu/shared-types';

/**
 * Enforce profile-targeted message visibility before rows leave the API boundary.
 *
 * `includeRestricted` is set only for staff reviewers: they may read restricted
 * messages they are not part of (read-only; writes stay audience-only).
 */
export function filterVisibleMessageRows<T extends RawMessageRow>(
  rows: T[],
  currentProfileId = '',
  options: { includeRestricted?: boolean } = {},
): T[] {
  return rows.filter((row) => {
    if (row.visibility_type !== 'specific-users') return true;
    if (!currentProfileId) return false;
    if (options.includeRestricted) return true;
    return (row.visibility_user_ids ?? []).includes(currentProfileId);
  });
}
