import type { AdminUserRow } from '@iconicedu/web/lib/admin/users';

export function getUserDisplayName(row: AdminUserRow): string {
  const firstName = row.firstName?.trim() ?? '';
  const lastName = row.lastName?.trim() ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  return row.displayName?.trim() || row.email || 'Unnamed';
}

export function buildAdminUserDmPath(orgSlug: string, profileId: string): string {
  return `/${orgSlug}/dm?id=${encodeURIComponent(profileId)}`;
}

export type GroupedAdminUserRow = {
  row: AdminUserRow;
  children: AdminUserRow[];
};

export function groupUsersByFamily(rows: AdminUserRow[]): GroupedAdminUserRow[] {
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const rowOrder = new Map(rows.map((row, index) => [row.id, index]));
  const groupedChildIds = new Set(
    rows.flatMap((row) =>
      row.profileKind === 'guardian' ? (row.linkedChildAccountIds ?? []) : [],
    ),
  );

  return rows.flatMap((row) => {
    if (row.profileKind === 'child' && groupedChildIds.has(row.id)) {
      return [];
    }

    if (row.profileKind !== 'guardian') {
      return [{ row, children: [] }];
    }

    const children = (row.linkedChildAccountIds ?? [])
      .map((childId) => rowById.get(childId) ?? null)
      .filter((child): child is AdminUserRow => child?.profileKind === 'child')
      .sort(
        (left, right) => (rowOrder.get(left.id) ?? 0) - (rowOrder.get(right.id) ?? 0),
      );

    return [{ row, children }];
  });
}
