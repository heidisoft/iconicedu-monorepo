'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  AdminUserProfilePreviewDialog,
} from '@iconicedu/ui-web';
import { toast } from '@iconicedu/ui-web';
import { AvatarWithStatus } from '@iconicedu/ui-web/components/shared/avatar-with-status';
import {
  getAvatarLocationLabel,
  getAvatarRoleLabel,
} from '@iconicedu/ui-web/components/shared/avatar-with-status';
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Copy,
  GraduationCap,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Shield,
  Trash2,
  User,
  Users,
} from '@iconicedu/ui-web';
import { Clock3, MapPin } from 'lucide-react';

import { AdminFilterBar } from '@iconicedu/web/components/admin/admin-filter-bar';
import { InviteUserDialog } from '@iconicedu/web/app/(app)/[orgSlug]/admin/users/invite-dialog';
import { buildAdminUserDmPath } from '@iconicedu/web/app/(app)/[orgSlug]/admin/users/users-table.utils';
import type { AdminUserRow } from '@iconicedu/web/lib/admin/users';
import type {
  AvatarSource,
  ThemeKey,
  UserAccountVM,
  UserProfileVM,
} from '@iconicedu/shared-types';

export type UserRow = AdminUserRow;

type UsersTableProps = {
  orgSlug: string;
};

type AdminUserProfilePreviewPayload = {
  account: UserAccountVM | null;
  profile: UserProfileVM | null;
  metadata: {
    accountId: string | null;
    accountOrgId: string | null;
    profileId: string | null;
    profileOrgId: string | null;
    profileAccountId: string | null;
    authUserId: string | null;
    managerStaffId: string | null;
    childProfileIds: string[];
    childAccountIds: string[];
    notificationScopeIds: string[];
    familyInviteIds: string[];
    familyInviteFamilyIds: string[];
    familyInviteAcceptedByAccountIds: string[];
    familyInviteCreatedByAccountIds: string[];
  };
};

type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'ghost'
  | 'link';

const STATUS_BADGE_VARIANTS: Record<string, BadgeVariant> = {
  active: 'default',
  invited: 'outline',
  archived: 'destructive',
};

const PROFILE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  educator: GraduationCap,
  staff: Briefcase,
  guardian: Users,
  child: Shield,
  owner: Shield,
  default: User,
};

const PAGE_SIZE = 10;
const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'guardian', label: 'Parent' },
  { value: 'educator', label: 'Tutor' },
  { value: 'child', label: 'Student' },
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Owner' },
];

const ROLE_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'pending', label: 'Pending review' },
  { value: 'active', label: 'Approved' },
  { value: 'blocked', label: 'Blocked' },
];

function formatRelativeLastSeen(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return null;
  }

  const diffMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return 'just now';
  if (minutes < 5) return 'few mins ago';
  if (minutes < 60) return `${minutes} mins ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} ago`;

  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

function getPageNumbers(current: number, total: number): (number | -1)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | -1)[] = [1];
  if (current > 3) pages.push(-1);
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push(-1);
  pages.push(total);
  return pages;
}

function getUserDisplayName(row: AdminUserRow): string {
  const firstName = row.firstName?.trim() ?? '';
  const lastName = row.lastName?.trim() ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  return row.displayName?.trim() || row.email || 'Unnamed';
}

export function UsersTable({ orgSlug }: UsersTableProps) {
  const router = useRouter();
  const [confirmDeleteUser, setConfirmDeleteUser] = React.useState<UserRow | null>(null);
  const [rowActionLoading, setRowActionLoading] = React.useState<string | null>(null);
  const [loginLink, setLoginLink] = React.useState<string | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = React.useState(false);
  const [loginLinkLoading, setLoginLinkLoading] = React.useState(false);
  const [editUser, setEditUser] = React.useState<UserRow | null>(null);
  const [editForm, setEditForm] = React.useState({
    email: '',
    displayName: '',
    firstName: '',
    lastName: '',
    primaryRole: 'unassigned',
    roleStatus: 'unassigned',
  });
  const [editSaving, setEditSaving] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [previewPayload, setPreviewPayload] =
    React.useState<AdminUserProfilePreviewPayload | null>(null);
  const [previewUser, setPreviewUser] = React.useState<UserRow | null>(null);

  // Lazy-load state
  const [rows, setRows] = React.useState<AdminUserRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | string>('all');
  const [roleFilter, setRoleFilter] = React.useState('all');
  const [sortBy, setSortBy] = React.useState<'recently_active' | 'created'>(
    'recently_active',
  );
  const [pageIndex, setPageIndex] = React.useState(1);

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setPageIndex(1);
  }, [debouncedSearch, statusFilter, roleFilter, sortBy]);

  // Fetch page from API
  const fetchPage = React.useCallback(
    async (page: number) => {
      setLoading(true);
      setFetchError(null);
      try {
        const params = new URLSearchParams({
          orgSlug,
          page: String(page),
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
          ...(roleFilter !== 'all' ? { role: roleFilter } : {}),
          ...(sortBy !== 'recently_active' ? { sortBy } : {}),
        });
        const res = await fetch(`/api/admin/users/list?${params.toString()}`);
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message ?? 'Failed to load');
        setRows(json.rows);
        setTotal(json.total);
        setPageCount(json.pageCount);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Failed to load users');
      } finally {
        setLoading(false);
      }
    },
    [orgSlug, debouncedSearch, statusFilter, roleFilter, sortBy],
  );

  React.useEffect(() => {
    void fetchPage(pageIndex);
  }, [fetchPage, pageIndex]);

  const handleRefresh = () => void fetchPage(pageIndex);

  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const openDeleteDialog = (row: UserRow) => {
    setConfirmDeleteUser(row);
  };

  const openEditDialog = (row: UserRow) => {
    setEditUser(row);
    setEditForm({
      email: row.email ?? '',
      displayName: row.displayName ?? '',
      firstName: row.firstName ?? '',
      lastName: row.lastName ?? '',
      primaryRole: row.primaryRole ?? 'unassigned',
      roleStatus: row.roleStatus ?? 'unassigned',
    });
  };

  const handleStartDirectMessage = (row: UserRow) => {
    if (!row.profileId) {
      toast.error(
        'This user does not have a profile yet. Invite or activate them first.',
      );
      return;
    }
    router.push(buildAdminUserDmPath(orgSlug, row.profileId));
  };

  const handleOpenProfilePreview = async (row: UserRow) => {
    setPreviewOpen(true);
    setPreviewUser(row);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewPayload(null);

    try {
      const params = new URLSearchParams({ accountId: row.id });
      const response = await fetch(
        `/api/admin/users/profile-preview?${params.toString()}`,
      );
      const result = (await response.json()) as {
        success?: boolean;
        message?: string;
        payload?: AdminUserProfilePreviewPayload;
      };

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? 'Unable to load profile preview');
      }

      setPreviewPayload(result.payload ?? null);
    } catch (error) {
      setPreviewError(
        error instanceof Error ? error.message : 'Unable to load profile preview',
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleEditSave = async () => {
    if (!editUser) {
      return;
    }

    if (!editForm.email.trim()) {
      toast.error('Email is required');
      return;
    }

    setEditSaving(true);
    try {
      const response = await fetch('/api/admin/users/update-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: editUser.id,
          email: editForm.email,
          displayName: editForm.displayName,
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          primaryRole: editForm.primaryRole,
          roleStatus: editForm.roleStatus,
        }),
      });

      const result = await response.json();
      if (!result?.success) {
        throw new Error(result?.message ?? 'Failed to update user');
      }

      toast.success('Profile updated');
      setEditUser(null);
      void fetchPage(pageIndex);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update user.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteUser) {
      return;
    }
    setDeletingId(confirmDeleteUser.id);
    try {
      const response = await fetch('/api/admin/users/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId: confirmDeleteUser.id }),
      });
      const result = await response.json();
      if (!result?.success) {
        throw new Error(result?.message ?? 'Failed to delete user');
      }
      setConfirmDeleteUser(null);
      void fetchPage(pageIndex);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to delete user.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRowInviteAction = async (row: UserRow, mode: 'invite' | 'link') => {
    if (rowActionLoading) {
      return;
    }
    setRowActionLoading(row.id);
    if (mode === 'link') {
      setLoginLinkLoading(true);
    }
    try {
      const redirectTo = `${window.location.origin.replace(/\/$/, '')}/auth/callback?profileKind=${encodeURIComponent(
        row.profileKind ?? 'guardian',
      )}`;
      const response = await fetch('/api/admin/users/invite-row', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: row.id,
          profileKind: row.profileKind ?? 'guardian',
          mode,
          linkType: mode === 'invite' ? 'invite' : 'magiclink',
          intent: mode === 'link' ? 'login' : 'get-started',
          redirectTo,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.message ?? 'Unable to perform invite action');
      }

      if (mode === 'link') {
        const link = result?.payload?.actionLink ?? result?.payload?.inviteUrl;
        if (!link) {
          throw new Error('Invite link missing');
        }
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(link);
        }
        setLoginLink(link);
        setLinkDialogOpen(true);
        toast.success('Invite link ready to copy');
      } else {
        toast.success('Magic link resent');
      }

      void fetchPage(pageIndex);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invite action failed');
    } finally {
      setRowActionLoading(null);
      setLoginLinkLoading(false);
    }
  };

  const renderUserRow = (row: UserRow) => {
    const displayName = getUserDisplayName(row);
    const relativeLastSeen = formatRelativeLastSeen(row.lastSeenAt);
    const Icon =
      PROFILE_ICON_MAP[row.profileKind ?? 'default'] ?? PROFILE_ICON_MAP.default;

    return (
      <div
        key={row.id}
        className={`px-6 py-4 border-b border-border/60 last:border-b-0 hover:bg-muted/30 transition-colors ${deletingId === row.id ? 'opacity-50' : ''}`}
      >
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="shrink-0 mt-0.5">
            <AvatarWithStatus
              accountId={row.id}
              profileId={row.profileId ?? null}
              name={displayName}
              avatar={{
                source: resolveAvatarSource(row.avatarSource),
                url: row.avatarUrl ?? null,
                seed:
                  resolveAvatarSource(row.avatarSource) === 'seed'
                    ? (row.email ?? undefined)
                    : undefined,
              }}
              themeKey={resolveThemeKey(row.themeKey)}
              email={row.email ?? null}
              roleLabel={getAvatarRoleLabel(row.profileKind ?? null)}
              timezone={row.timezone ?? null}
              locationLabel={getAvatarLocationLabel({
                city: null,
                region: null,
                countryName: row.countryName ?? null,
              })}
              onMessageClick={
                row.profileId ? () => handleStartDirectMessage(row) : undefined
              }
              sizeClassName="size-9"
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                className="text-sm font-semibold underline-offset-4 hover:underline"
                onClick={() => void handleOpenProfilePreview(row)}
              >
                {displayName}
              </button>
              {row.profileKind && (
                <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                  <Icon className="h-3 w-3" aria-hidden />
                  {row.profileKind.charAt(0).toUpperCase() + row.profileKind.slice(1)}
                </span>
              )}
              {row.profileKind === 'guardian' &&
                (row.linkedChildAccountIds?.length ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" aria-hidden />
                    {row.linkedChildAccountIds!.length}{' '}
                    {row.linkedChildAccountIds!.length === 1 ? 'child' : 'children'}
                  </span>
                )}
            </div>
            {(row.email || row.phone) && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {row.email ?? row.phone}
              </p>
            )}
            {/* Chips */}
            {(row.countryName || relativeLastSeen) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {row.countryName && (
                  <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                    {row.countryName}
                  </span>
                )}
                {relativeLastSeen && (
                  <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                    <Clock3 className="h-3 w-3 shrink-0" aria-hidden />
                    {relativeLastSeen}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: status badge + actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant={STATUS_BADGE_VARIANTS[row.status] ?? 'ghost'}
              className="text-xs capitalize"
            >
              {row.status}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label={`Actions for ${displayName}`}
                  disabled={deletingId === row.id}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => openEditDialog(row)}
                  disabled={Boolean(rowActionLoading) || deletingId === row.id}
                >
                  <User className="size-3 mr-2" /> Edit profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleStartDirectMessage(row)}
                  disabled={
                    Boolean(rowActionLoading) || deletingId === row.id || !row.profileId
                  }
                >
                  <MessageCircle className="size-3 mr-2" /> Send message
                </DropdownMenuItem>
                {row.status === 'invited' && (
                  <DropdownMenuItem
                    onClick={() => handleRowInviteAction(row, 'invite')}
                    disabled={Boolean(rowActionLoading) || deletingId === row.id}
                  >
                    <Copy className="size-3 mr-2" /> Resend invite
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => handleRowInviteAction(row, 'link')}
                  disabled={Boolean(rowActionLoading) || deletingId === row.id}
                >
                  <Copy className="size-3 mr-2" /> Generate a login link
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => openDeleteDialog(row)}
                  disabled={deletingId === row.id}
                >
                  <Trash2 className="size-3 mr-2" />
                  {deletingId === row.id ? 'Deleting…' : 'Delete'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all enrolled users, families, educators, and staff.
          </p>
        </div>
        <InviteUserDialog />
      </div>

      {/* Filter bar */}
      <AdminFilterBar
        search={search}
        onSearchChange={setSearch}
        filterGroups={[
          {
            label: 'Status',
            value: statusFilter,
            options: [
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'invited', label: 'Invited' },
              { value: 'archived', label: 'Archived' },
            ],
            onChange: setStatusFilter,
          },
          {
            label: 'Role',
            value: roleFilter,
            options: [
              { value: 'all', label: 'All' },
              { value: 'guardian', label: 'Parent' },
              { value: 'educator', label: 'Tutor' },
              { value: 'child', label: 'Student' },
              { value: 'staff', label: 'Staff' },
            ],
            onChange: setRoleFilter,
          },
          {
            label: 'Sort',
            value: sortBy,
            options: [
              { value: 'recently_active', label: 'Recently active' },
              { value: 'created', label: 'Newest first' },
            ],
            onChange: (v) => setSortBy(v as 'recently_active' | 'created'),
          },
        ]}
      />

      <div className="rounded-xl border overflow-hidden">
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 rounded-xl bg-card/90 flex items-center justify-center z-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {/* Container header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
            <h2 className="text-sm font-semibold">Members</h2>
          </div>
          <div className="divide-y divide-border">
            {fetchError ? (
              <div className="px-6 py-10 text-center text-sm text-destructive">
                {fetchError}
              </div>
            ) : !loading && rows.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                No users found.
              </div>
            ) : (
              rows.map((row) => renderUserRow(row))
            )}
          </div>
        </div>
        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t">
            <p className="text-xs text-muted-foreground">
              {(pageIndex - 1) * PAGE_SIZE + 1}–{Math.min(pageIndex * PAGE_SIZE, total)}{' '}
              of {total}
            </p>
            {pageCount > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={pageIndex <= 1}
                  onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {getPageNumbers(pageIndex, pageCount).map((p, i) =>
                  p === -1 ? (
                    <span
                      key={`ellipsis-${i}`}
                      className="px-1 text-xs text-muted-foreground"
                    >
                      …
                    </span>
                  ) : (
                    <Button
                      key={p}
                      variant={p === pageIndex ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 w-8 p-0 text-xs"
                      onClick={() => setPageIndex(p)}
                    >
                      {p}
                    </Button>
                  ),
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={pageIndex >= pageCount}
                  onClick={() => setPageIndex((p) => Math.min(pageCount, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      <AlertDialog
        open={Boolean(confirmDeleteUser)}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDeleteUser(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              Removing this account will delete every record tied to it, including
              profiles and family links. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={Boolean(deletingId)}
              >
                {deletingId ? 'Deleting…' : 'Delete account'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={linkDialogOpen} onOpenChange={(open) => setLinkDialogOpen(open)}>
        <DialogContent className="space-y-4 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generated login link</DialogTitle>
            <DialogDescription>
              Copy this magic link and share it with the user.
            </DialogDescription>
          </DialogHeader>
          <div className="relative rounded-lg border border-border bg-muted px-3 py-2 text-sm">
            {loginLinkLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-card/80">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground wrap-break-word">
                {loginLink}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="px-2"
                disabled={!loginLink}
                onClick={async () => {
                  if (!loginLink || !navigator?.clipboard?.writeText) {
                    return;
                  }
                  await navigator.clipboard.writeText(loginLink);
                  toast.success('Invite link copied');
                }}
              >
                <Copy className="size-4" />
                <span className="sr-only">Copy login link</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <AdminUserProfilePreviewDialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) {
            setPreviewUser(null);
            setPreviewPayload(null);
            setPreviewError(null);
            setPreviewLoading(false);
          }
        }}
        account={previewPayload?.account ?? null}
        profile={previewPayload?.profile ?? null}
        metadata={previewPayload?.metadata ?? null}
        isLoading={previewLoading}
        error={previewError}
        onDmClick={
          previewUser?.profileId ? () => handleStartDirectMessage(previewUser) : undefined
        }
      />
      <Dialog
        open={Boolean(editUser)}
        onOpenChange={(open) => {
          if (!open) {
            setEditUser(null);
          }
        }}
      >
        <DialogContent className="space-y-4 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              Update account email and profile name fields.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Email</p>
              <Input
                value={editForm.email}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="email@example.com"
                type="email"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Display name</p>
              <Input
                value={editForm.displayName}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, displayName: event.target.value }))
                }
                placeholder="Display name"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">First name</p>
                <Input
                  value={editForm.firstName}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, firstName: event.target.value }))
                  }
                  placeholder="First name"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Last name</p>
                <Input
                  value={editForm.lastName}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, lastName: event.target.value }))
                  }
                  placeholder="Last name"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Role</p>
                <Select
                  value={editForm.primaryRole}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({ ...prev, primaryRole: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Role approval status</p>
                <Select
                  value={editForm.roleStatus}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({ ...prev, roleStatus: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditUser(null)}
              disabled={editSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function resolveAvatarSource(value?: string | null): AvatarSource {
  if (value === 'upload' || value === 'external') {
    return value;
  }
  return 'seed';
}

function resolveThemeKey(value?: string | null): ThemeKey | null {
  if (!value) {
    return null;
  }
  return value as ThemeKey;
}
