'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  AdminUserProfilePreviewDialog,
} from '@iconicedu/ui-web';
import { toast } from '@iconicedu/ui-web';
import { AvatarWithStatus } from '@iconicedu/ui-web/components/shared/avatar-with-status';
import {
  Briefcase,
  Copy,
  ChevronRight,
  GraduationCap,
  Shield,
  User,
  Users,
  Trash2,
  MoreHorizontal,
  RotateCw,
  Loader2,
  MessageCircle,
} from '@iconicedu/ui-web';

import { InviteUserDialog } from '@iconicedu/web/app/(app)/[orgSlug]/admin/users/invite-dialog';
import {
  buildAdminUserDmPath,
  groupUsersByFamily,
} from '@iconicedu/web/app/(app)/[orgSlug]/admin/users/users-table.utils';
import type { AdminUserRow } from '@iconicedu/web/lib/admin/users';
import type {
  AvatarSource,
  ThemeKey,
  UserAccountVM,
  UserProfileVM,
} from '@iconicedu/shared-types';

export type UserRow = AdminUserRow;

type SortKey = 'name' | 'status' | 'joined';

type UsersTableProps = {
  rows: AdminUserRow[];
};

type AdminUserProfilePreviewPayload = {
  account: UserAccountVM | null;
  profile: UserProfileVM | null;
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

const PAGE_SIZES = [10, 25, 50];
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

function getUserDisplayName(row: AdminUserRow): string {
  const firstName = row.firstName?.trim() ?? '';
  const lastName = row.lastName?.trim() ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  if (fullName) {
    return fullName;
  }

  return row.displayName?.trim() || row.email || 'Unnamed';
}

export function UsersTable({ rows }: UsersTableProps) {
  const router = useRouter();
  const params = useParams<{ orgSlug?: string | string[] }>();
  const [isPending, startTransition] = React.useTransition();
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
  const [expandedParentIds, setExpandedParentIds] = React.useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [previewPayload, setPreviewPayload] =
    React.useState<AdminUserProfilePreviewPayload | null>(null);
  const [previewUser, setPreviewUser] = React.useState<UserRow | null>(null);
  const refreshing = isPending;

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | string>('all');
  const [sortKey, setSortKey] = React.useState<SortKey>('name');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');
  const [pageIndex, setPageIndex] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZES[0]);

  React.useEffect(() => {
    setPageIndex(1);
  }, [search, statusFilter, pageSize]);

  const normalizedSearch = React.useMemo(() => search.trim().toLowerCase(), [search]);

  const filteredRows = React.useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      const title = getUserDisplayName(row).toLowerCase();
      if (title.includes(normalizedSearch)) {
        return true;
      }
      if (row.email?.toLowerCase().includes(normalizedSearch)) {
        return true;
      }
      if (row.phone?.toLowerCase().includes(normalizedSearch)) {
        return true;
      }
      if (row.profileKind?.toLowerCase().includes(normalizedSearch)) {
        return true;
      }
      return false;
    });
  }, [rows, normalizedSearch, statusFilter]);

  const sortedRows = React.useMemo(() => {
    const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
    return [...filteredRows].sort((a, b) => {
      let compare = 0;
      if (sortKey === 'name') {
        compare = collator.compare(getUserDisplayName(a), getUserDisplayName(b));
      } else if (sortKey === 'status') {
        compare = collator.compare(a.status, b.status);
      } else {
        compare = collator.compare(a.createdAt ?? '', b.createdAt ?? '');
      }
      return sortDirection === 'asc' ? compare : -compare;
    });
  }, [filteredRows, sortDirection, sortKey]);

  const groupedRows = React.useMemo(() => groupUsersByFamily(sortedRows), [sortedRows]);

  const totalRows = groupedRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const visibleGroups = groupedRows.slice(
    (pageIndex - 1) * pageSize,
    pageIndex * pageSize,
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  };

  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const rawOrgSlug = params?.orgSlug;
  const orgSlug = Array.isArray(rawOrgSlug) ? rawOrgSlug[0] : rawOrgSlug;

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
    if (!orgSlug) {
      toast.error('Unable to open DM from this page.');
      return;
    }
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
      await router.refresh();
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
      await router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to delete user.');
    } finally {
      setDeletingId(null);
    }
  };

  const renderSortIndicator = (key: SortKey) => {
    if (sortKey !== key) {
      return null;
    }
    return (
      <span aria-hidden="true" className="ml-1 text-xs opacity-70">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
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

      await router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invite action failed');
    } finally {
      setRowActionLoading(null);
      setLoginLinkLoading(false);
    }
  };

  const toggleExpandedParent = (parentId: string) => {
    setExpandedParentIds((current) =>
      current.includes(parentId)
        ? current.filter((id) => id !== parentId)
        : [...current, parentId],
    );
  };

  const renderUserRow = (
    row: UserRow,
    options?: { childrenCount?: number; expanded?: boolean },
  ) => {
    const displayName = getUserDisplayName(row);
    const Icon =
      PROFILE_ICON_MAP[row.profileKind ?? 'default'] ?? PROFILE_ICON_MAP.default;
    const childrenCount = options?.childrenCount ?? 0;
    const expanded = options?.expanded ?? false;
    const isExpandable = childrenCount > 0;

    return (
      <TableRow key={row.id} data-deleting={deletingId === row.id ? 'true' : 'false'}>
        <TableCell>
          <div className="flex items-center gap-3">
            {isExpandable ? (
              <button
                type="button"
                onClick={() => toggleExpandedParent(row.id)}
                className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted"
                aria-label={
                  expanded ? 'Collapse child accounts' : 'Expand child accounts'
                }
                aria-expanded={expanded}
              >
                <ChevronRight
                  className={`size-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
                />
              </button>
            ) : (
              <div className="size-7 shrink-0" aria-hidden="true" />
            )}
            <AvatarWithStatus
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
              showStatus={false}
              sizeClassName="size-8"
              initialsLength={1}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-left text-sm font-semibold capitalize underline-offset-4 hover:underline"
                  onClick={() => void handleOpenProfilePreview(row)}
                >
                  {displayName}
                </button>
                {isExpandable ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase tracking-wide"
                  >
                    {childrenCount} child{childrenCount === 1 ? '' : 'ren'}
                  </Badge>
                ) : null}
              </div>
              {row.email ? (
                <p className="text-xs text-muted-foreground">{row.email}</p>
              ) : null}
              {row.phone ? (
                <p className="text-xs text-muted-foreground">{row.phone}</p>
              ) : null}
              {!row.email && !row.phone ? (
                <p className="text-xs text-muted-foreground">—</p>
              ) : null}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <div className="inline-flex items-center gap-2 text-sm capitalize">
            <Icon className="size-4 text-muted-foreground" aria-hidden />
            {row.profileKind ?? 'account'}
          </div>
        </TableCell>
        <TableCell>
          <p className="text-sm">{row.countryName ?? '—'}</p>
          <p className="text-xs text-muted-foreground">{row.timezone ?? '—'}</p>
        </TableCell>
        <TableCell>
          <Badge
            variant={STATUS_BADGE_VARIANTS[row.status] ?? 'ghost'}
            className="text-xs capitalize"
          >
            {row.status}
          </Badge>
        </TableCell>
        <TableCell>
          {row.createdAt ? (
            <p className="text-sm">{new Date(row.createdAt).toLocaleDateString()}</p>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell>
          {row.lastSignInAt ? (
            <p className="text-sm">{new Date(row.lastSignInAt).toLocaleDateString()}</p>
          ) : (
            <span className="text-sm text-muted-foreground">n/a</span>
          )}
        </TableCell>
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="px-2"
                aria-label={`Actions for ${displayName}`}
                disabled={deletingId === row.id}
              >
                <MoreHorizontal className="size-4" />
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
        </TableCell>
      </TableRow>
    );
  };

  const renderChildPanelRow = (parent: UserRow, children: UserRow[]) => {
    return (
      <TableRow key={`${parent.id}:children`} className="bg-muted/20">
        <TableCell colSpan={7} className="py-0">
          <div className="ml-10 mr-3 my-3 rounded-xl border border-border/60 bg-background p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Linked child accounts</p>
                <p className="text-xs text-muted-foreground">
                  Accounts connected to {getUserDisplayName(parent)}.
                </p>
              </div>
              <Badge variant="secondary">{children.length}</Badge>
            </div>
            <div className="space-y-2">
              {children.map((child) => {
                const displayName = getUserDisplayName(child);
                const Icon =
                  PROFILE_ICON_MAP[child.profileKind ?? 'default'] ??
                  PROFILE_ICON_MAP.default;
                return (
                  <div
                    key={`${parent.id}:${child.id}`}
                    className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card px-3 py-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <AvatarWithStatus
                        name={displayName}
                        avatar={{
                          source: resolveAvatarSource(child.avatarSource),
                          url: child.avatarUrl ?? null,
                          seed:
                            resolveAvatarSource(child.avatarSource) === 'seed'
                              ? (child.email ?? undefined)
                              : undefined,
                        }}
                        themeKey={resolveThemeKey(child.themeKey)}
                        showStatus={false}
                        sizeClassName="size-8"
                        initialsLength={1}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="text-left text-sm font-semibold capitalize underline-offset-4 hover:underline"
                            onClick={() => void handleOpenProfilePreview(child)}
                          >
                            {displayName}
                          </button>
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase tracking-wide"
                          >
                            Child
                          </Badge>
                        </div>
                        {child.email ? (
                          <p className="text-xs text-muted-foreground">{child.email}</p>
                        ) : null}
                        {child.phone ? (
                          <p className="text-xs text-muted-foreground">{child.phone}</p>
                        ) : null}
                        {!child.email && !child.phone ? (
                          <p className="text-xs text-muted-foreground">—</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 md:justify-end">
                      <div className="inline-flex items-center gap-2 text-sm capitalize">
                        <Icon className="size-4 text-muted-foreground" aria-hidden />
                        {child.profileKind ?? 'account'}
                      </div>
                      <Badge
                        variant={STATUS_BADGE_VARIANTS[child.status] ?? 'ghost'}
                        className="text-xs capitalize"
                      >
                        {child.status}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="px-2"
                            aria-label={`Actions for ${displayName}`}
                            disabled={deletingId === child.id}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => openEditDialog(child)}
                            disabled={
                              Boolean(rowActionLoading) || deletingId === child.id
                            }
                          >
                            <User className="size-3 mr-2" /> Edit profile
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStartDirectMessage(child)}
                            disabled={
                              Boolean(rowActionLoading) ||
                              deletingId === child.id ||
                              !child.profileId
                            }
                          >
                            <MessageCircle className="size-3 mr-2" /> Send message
                          </DropdownMenuItem>
                          {child.status === 'invited' && (
                            <DropdownMenuItem
                              onClick={() => handleRowInviteAction(child, 'invite')}
                              disabled={
                                Boolean(rowActionLoading) || deletingId === child.id
                              }
                            >
                              <Copy className="size-3 mr-2" /> Resend invite
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleRowInviteAction(child, 'link')}
                            disabled={
                              Boolean(rowActionLoading) || deletingId === child.id
                            }
                          >
                            <Copy className="size-3 mr-2" /> Generate a login link
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(child)}
                            disabled={deletingId === child.id}
                          >
                            <Trash2 className="size-3 mr-2" />
                            {deletingId === child.id ? 'Deleting…' : 'Delete'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="w-full space-y-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <InviteUserDialog />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search name, email or role"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-64"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value)}
            >
              <SelectTrigger size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="invited">Invited</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              className="px-2"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh users"
            >
              {refreshing ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : (
                <RotateCw className="size-4 transition-transform" />
              )}
            </Button>
          </div>
        </div>
      </div>
      <div className="relative">
        {isPending && (
          <div className="absolute inset-0 rounded-2xl border border-border bg-card/90 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  type="button"
                  className="flex items-center"
                  onClick={() => handleSort('name')}
                >
                  Name {renderSortIndicator('name')}
                </button>
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Country / timezone</TableHead>
              <TableHead>
                <button
                  type="button"
                  className="flex items-center"
                  onClick={() => handleSort('status')}
                >
                  Status {renderSortIndicator('status')}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  className="flex items-center"
                  onClick={() => handleSort('joined')}
                >
                  Joined {renderSortIndicator('joined')}
                </button>
              </TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleGroups.flatMap((group) => {
              const expanded = expandedParentIds.includes(group.row.id);
              return [
                renderUserRow(group.row, {
                  childrenCount: group.children.length,
                  expanded,
                }),
                ...(expanded && group.children.length
                  ? [renderChildPanelRow(group.row, group.children)]
                  : []),
              ];
            })}
          </TableBody>
        </Table>
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Page size</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => setPageSize(Number(value))}
          >
            <SelectTrigger size="sm" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={pageIndex <= 1}
            onClick={() => setPageIndex((prev) => Math.max(1, prev - 1))}
          >
            Previous
          </Button>
          <span>
            Page {pageIndex} of {pageCount}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={pageIndex >= pageCount}
            onClick={() => setPageIndex((prev) => Math.min(pageCount, prev + 1))}
          >
            Next
          </Button>
        </div>
      </div>
      <Dialog open={linkDialogOpen} onOpenChange={(open) => setLinkDialogOpen(open)}>
        <DialogContent className="space-y-4 sm:max-w-[42rem]">
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
              <span
                className="text-xs text-muted-foreground break-words"
                style={{ wordBreak: 'break-word' }}
              >
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
        <DialogContent className="space-y-4 sm:max-w-[42rem]">
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
