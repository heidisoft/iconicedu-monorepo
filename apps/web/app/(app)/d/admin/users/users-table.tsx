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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@iconicedu/ui-web';
import { toast } from '@iconicedu/ui-web';
import { AvatarWithStatus } from '@iconicedu/ui-web/components/shared/avatar-with-status';
import {
  Briefcase,
  Copy,
  GraduationCap,
  Shield,
  User,
  Users,
  Trash2,
  MoreHorizontal,
  RotateCw,
  Loader2,
} from '@iconicedu/ui-web';

import { InviteUserDialog } from '@iconicedu/web/app/(app)/d/admin/users/invite-dialog';
import type { AdminUserRow } from '@iconicedu/web/lib/admin/users';

export type UserRow = AdminUserRow;

type SortKey = 'name' | 'email' | 'status' | 'joined';

type UsersTableProps = {
  rows: AdminUserRow[];
};

const STATUS_BADGE_VARIANTS: Record<string, string> = {
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

export function UsersTable({ rows }: UsersTableProps) {
  const router = useRouter();
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
  });
  const [editSaving, setEditSaving] = React.useState(false);
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
      const title = (row.displayName ?? row.email ?? row.profileKind ?? '').toLowerCase();
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
        compare = collator.compare(a.displayName ?? '', b.displayName ?? '');
      } else if (sortKey === 'email') {
        compare = collator.compare(a.email ?? '', b.email ?? '');
      } else if (sortKey === 'status') {
        compare = collator.compare(a.status, b.status);
      } else {
        compare = collator.compare(a.createdAt ?? '', b.createdAt ?? '');
      }
      return sortDirection === 'asc' ? compare : -compare;
    });
  }, [filteredRows, sortDirection, sortKey]);

  const totalRows = sortedRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const visibleRows = sortedRows.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  };

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
    });
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
      const response = await fetch('/d/admin/users/actions/update-user', {
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
      const response = await fetch('/d/admin/users/actions/delete-user', {
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
      const response = await fetch('/d/admin/users/actions/invite-row', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: row.id,
          profileKind: row.profileKind ?? 'guardian',
          mode,
          linkType: mode === 'invite' ? 'invite' : 'magiclink',
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
            <TableHead>
              <button
                type="button"
                className="flex items-center"
                onClick={() => handleSort('email')}
              >
                Email {renderSortIndicator('email')}
              </button>
            </TableHead>
            <TableHead>Type</TableHead>
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
          {visibleRows.map((row) => {
            const displayName = row.displayName || row.email || 'Unnamed';
            const Icon =
              PROFILE_ICON_MAP[row.profileKind ?? 'default'] ?? PROFILE_ICON_MAP.default;
            return (
              <TableRow
                key={row.id}
                data-deleting={deletingId === row.id ? 'true' : 'false'}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <AvatarWithStatus
                      name={displayName}
                      avatar={{
                        source: row.avatarSource ? row.avatarSource : 'seed',
                        url: row.avatarUrl ?? null,
                        seed: row.avatarSource ? undefined : row.email ?? undefined,
                      }}
                      themeKey={row.themeKey ?? null}
                      showStatus={false}
                      sizeClassName="size-8"
                      initialsLength={2}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold capitalize">{displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.phone ?? row.email ?? '—'}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="text-sm">{row.email ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">{row.phone ?? '—'}</p>
                </TableCell>
                <TableCell>
                  <div className="inline-flex items-center gap-2 text-sm capitalize">
                    <Icon className="size-4 text-muted-foreground" aria-hidden />
                    {row.profileKind ?? 'account'}
                  </div>
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
                    <p className="text-sm">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </p>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {row.lastSignInAt ? (
                    <p className="text-sm">
                      {new Date(row.lastSignInAt).toLocaleDateString()}
                    </p>
                  ) : (
                    <span className="text-sm text-muted-foreground">n/a</span>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu disabled={deletingId === row.id}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="px-2">
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
        <DialogContent className="max-w-md space-y-4">
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
      <Dialog
        open={Boolean(editUser)}
        onOpenChange={(open) => {
          if (!open) {
            setEditUser(null);
          }
        }}
      >
        <DialogContent className="max-w-md space-y-4">
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
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditUser(null)} disabled={editSaving}>
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
