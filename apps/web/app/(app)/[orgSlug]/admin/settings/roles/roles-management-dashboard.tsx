'use client';

import * as React from 'react';
import type { RoleKey } from '@iconicedu/shared-types';
import { Badge, Button, Input, Loader2, Search, Trash2, toast } from '@iconicedu/ui-web';

type RolesManagementDashboardProps = {
  orgId: string;
};

type RoleManagementUserVM = {
  accountId: string;
  email: string | null;
  displayName: string;
  profileKind: string | null;
  roles: RoleKey[];
};

const ROLE_OPTIONS: Array<{ value: RoleKey; label: string }> = [
  { value: 'guardian', label: 'Parent' },
  { value: 'educator', label: 'Tutor' },
  { value: 'child', label: 'Student' },
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Owner' },
];

function roleLabel(roleKey: RoleKey) {
  return ROLE_OPTIONS.find((option) => option.value === roleKey)?.label ?? roleKey;
}

function isProtectedRole(roleKey: RoleKey) {
  return roleKey === 'owner' || roleKey === 'admin';
}

export function RolesManagementDashboard({ orgId }: RolesManagementDashboardProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [users, setUsers] = React.useState<RoleManagementUserVM[]>([]);
  const [selectedAccountId, setSelectedAccountId] = React.useState<string>('');
  const [selectedRole, setSelectedRole] = React.useState<RoleKey>('guardian');

  const loadUsers = React.useCallback(
    async (input?: { preserveSelection?: boolean }) => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/admin/settings/roles?orgId=${encodeURIComponent(orgId)}`,
        );
        const payload = (await response.json()) as {
          success?: boolean;
          message?: string;
          data?: { users?: RoleManagementUserVM[] };
        };
        if (!response.ok || !payload.success || !payload.data?.users) {
          throw new Error(payload.message ?? 'Failed to load role assignments.');
        }

        const nextUsers = payload.data.users;
        setUsers(nextUsers);
        setSelectedAccountId((prev) => {
          if (input?.preserveSelection && prev) {
            return nextUsers.some((user) => user.accountId === prev)
              ? prev
              : (nextUsers[0]?.accountId ?? '');
          }
          return prev || nextUsers[0]?.accountId || '';
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to load role assignments.',
        );
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  React.useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = React.useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) {
      return users;
    }
    return users.filter((user) => {
      const displayName = user.displayName.toLowerCase();
      const email = user.email?.toLowerCase() ?? '';
      const profileKind = user.profileKind?.toLowerCase() ?? '';
      return (
        displayName.includes(normalized) ||
        email.includes(normalized) ||
        profileKind.includes(normalized)
      );
    });
  }, [search, users]);

  const selectedUser = React.useMemo(
    () => users.find((user) => user.accountId === selectedAccountId) ?? null,
    [selectedAccountId, users],
  );

  const handleAssignRole = React.useCallback(async () => {
    if (!selectedUser) {
      toast.error('Select a user first.');
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/settings/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          accountId: selectedUser.accountId,
          roleKey: selectedRole,
        }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? 'Failed to assign role.');
      }
      toast.success(`${roleLabel(selectedRole)} role assigned`);
      await loadUsers({ preserveSelection: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign role.');
    } finally {
      setIsSaving(false);
    }
  }, [loadUsers, orgId, selectedRole, selectedUser]);

  const handleRemoveRole = React.useCallback(
    async (roleKey: RoleKey) => {
      if (!selectedUser) {
        return;
      }
      setIsSaving(true);
      try {
        const response = await fetch('/api/admin/settings/roles', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId,
            accountId: selectedUser.accountId,
            roleKey,
          }),
        });
        const payload = (await response.json()) as {
          success?: boolean;
          message?: string;
        };
        if (!response.ok || !payload.success) {
          throw new Error(payload.message ?? 'Failed to remove role.');
        }
        toast.success(`${roleLabel(roleKey)} role removed`);
        await loadUsers({ preserveSelection: true });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to remove role.');
      } finally {
        setIsSaving(false);
      }
    },
    [loadUsers, orgId, selectedUser],
  );

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading role assignments...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
          <h2 className="text-sm font-semibold">User selector</h2>
          <p className="text-xs text-muted-foreground">
            Search and pick a user to manage their user_roles records.
          </p>
        </div>
        <div className="px-6 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 h-9 w-full md:max-w-md rounded-lg border bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
              placeholder="Search users by name, email, or profile kind"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="roles-user-select" className="mb-2 block text-sm font-medium">
              User
            </label>
            <select
              id="roles-user-select"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
            >
              {filteredUsers.map((user) => (
                <option key={user.accountId} value={user.accountId}>
                  {user.displayName}
                  {user.email ? ` (${user.email})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
          <h2 className="text-sm font-semibold">Assign role</h2>
          <p className="text-xs text-muted-foreground">
            Add or restore a role record for the selected user.
          </p>
        </div>
        <div className="px-6 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="w-full md:max-w-xs">
              <label
                htmlFor="roles-role-select"
                className="mb-2 block text-sm font-medium"
              >
                Role
              </label>
              <select
                id="roles-role-select"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value as RoleKey)}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={() => void handleAssignRole()}
              disabled={isSaving || !selectedUser}
            >
              {isSaving ? 'Saving...' : 'Assign role'}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
          <h2 className="text-sm font-semibold">Current roles</h2>
          <p className="text-xs text-muted-foreground">
            Owner and admin roles are protected from removal on this page.
          </p>
        </div>
        <div className="px-6 py-4">
          {!selectedUser ? (
            <p className="text-sm text-muted-foreground">Select a user to view roles.</p>
          ) : selectedUser.roles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No roles assigned.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedUser.roles.map((role) => (
                <div
                  key={role}
                  className="flex items-center gap-2 rounded-md border border-border px-2 py-1"
                >
                  <Badge variant="secondary">{roleLabel(role)}</Badge>
                  {isProtectedRole(role) ? null : (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${roleLabel(role)} role`}
                      disabled={isSaving}
                      onClick={() => void handleRemoveRole(role)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
