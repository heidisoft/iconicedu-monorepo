'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AvatarGroup,
  Badge,
  Button,
  Archive,
  ArchiveRestore,
  Pencil,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  MessageCircle,
  MoreHorizontal,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Trash2,
  toast,
} from '@iconicedu/ui-web';
import { getLearningSpaceIcon } from '@iconicedu/ui-web/lib/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@iconicedu/ui-web/ui/tooltip';
import { AvatarWithStatus } from '@iconicedu/ui-web/components/shared/avatar-with-status';
import type { ThemeKey } from '@iconicedu/shared-types';

import type { AdminChannelRow } from '@iconicedu/web/lib/admin/channels';

type ChannelsTableProps = {
  rows: AdminChannelRow[];
  onEdit: (row: AdminChannelRow) => void;
};

const STATUS_BADGE_VARIANTS: Record<string, 'secondary' | 'outline' | 'ghost'> = {
  active: 'secondary',
  archived: 'outline',
};

function resolveDashboardBasePath(pathname: string | null): string {
  const firstSegment = pathname?.split('/').filter(Boolean)[0];
  if (!firstSegment) {
    return '/';
  }
  return `/${firstSegment}`;
}

function getChannelHref(row: AdminChannelRow, dashboardBasePath: string) {
  const isLearningSpace =
    row.purpose === 'learning-space' || row.primary_entity_kind === 'learning_space';
  return isLearningSpace
    ? `${dashboardBasePath}/s/${row.id}`
    : `${dashboardBasePath}/c/${row.id}`;
}

function formatType(row: AdminChannelRow) {
  const primary = row.purpose || row.kind || 'channel';
  const secondary = row.kind && row.kind !== primary ? row.kind : null;
  return { primary, secondary };
}

export function ChannelsTable({ rows, onEdit }: ChannelsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const dashboardBasePath = React.useMemo(
    () => resolveDashboardBasePath(pathname),
    [pathname],
  );
  const [confirmDeleteRow, setConfirmDeleteRow] = React.useState<AdminChannelRow | null>(
    null,
  );
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [archivingId, setArchivingId] = React.useState<string | null>(null);
  const [unarchivingId, setUnarchivingId] = React.useState<string | null>(null);

  const handleDelete = async (row: AdminChannelRow) => {
    setDeletingId(row.id);
    try {
      const response = await fetch('/api/admin/channels/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: row.id }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        toast.error(payload.message ?? 'Unable to delete channel.');
        return;
      }
      toast.success('Channel deleted.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete channel.');
    } finally {
      setDeletingId(null);
      setConfirmDeleteRow(null);
    }
  };

  const handleArchive = async (row: AdminChannelRow) => {
    setArchivingId(row.id);
    try {
      const response = await fetch('/api/admin/channels/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: row.id }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        toast.error(payload.message ?? 'Unable to archive channel.');
        return;
      }
      toast.success('Channel archived.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to archive channel.');
    } finally {
      setArchivingId(null);
    }
  };

  const handleUnarchive = async (row: AdminChannelRow) => {
    setUnarchivingId(row.id);
    try {
      const response = await fetch('/api/admin/channels/unarchive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: row.id }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        toast.error(payload.message ?? 'Unable to unarchive channel.');
        return;
      }
      toast.success('Channel restored.');
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to unarchive channel.',
      );
    } finally {
      setUnarchivingId(null);
    }
  };

  return (
    <div className="w-full border-y border-border bg-card">
      <Table className="min-w-full">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Participants</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isLearningSpace =
              row.purpose === 'learning-space' ||
              row.primary_entity_kind === 'learning_space';
            const TitleIcon = isLearningSpace
              ? getLearningSpaceIcon(row.icon_key)
              : MessageCircle;
            const type = formatType(row);
            return (
              <TableRow
                key={row.id}
                className="border-b border-border/60 last:border-b-0"
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full border border-border bg-muted">
                      <TitleIcon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={getChannelHref(row, dashboardBasePath)}
                        className="text-sm font-semibold hover:underline"
                      >
                        {row.topic}
                      </Link>
                      {row.description ? (
                        <p className="text-xs text-muted-foreground">{row.description}</p>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="text-sm capitalize">{type.primary}</p>
                  {type.secondary ? (
                    <p className="text-xs text-muted-foreground capitalize">
                      {type.secondary}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>
                  {row.kind === 'dm' || row.kind === 'group_dm' ? (
                    row.participantDetails?.length ? (
                      <AvatarGroup className="justify-start">
                        {row.participantDetails.map((participant) => (
                          <Tooltip key={participant.id}>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <AvatarWithStatus
                                  name={participant.displayName}
                                  avatar={{
                                    source: participant.avatarUrl ? 'upload' : 'seed',
                                    url: participant.avatarUrl ?? null,
                                  }}
                                  themeKey={
                                    (participant.themeKey as ThemeKey | null) ?? null
                                  }
                                  showStatus={false}
                                  sizeClassName="size-8"
                                  initialsLength={1}
                                />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs font-medium">
                                {participant.displayName}
                              </p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {participant.kind}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </AvatarGroup>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {row.participantCount}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={STATUS_BADGE_VARIANTS[row.status] ?? 'ghost'}
                    className="text-xs px-3"
                  >
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {new Date(row.created_at).toLocaleDateString()}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="px-2">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(row)}>
                        <Pencil className="mr-2 size-3" />
                        Edit
                      </DropdownMenuItem>
                      {row.status === 'archived' ? (
                        <DropdownMenuItem
                          onClick={() => handleUnarchive(row)}
                          disabled={unarchivingId === row.id}
                        >
                          <ArchiveRestore className="mr-2 size-3" />
                          {unarchivingId === row.id ? 'Restoring…' : 'Unarchive'}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => handleArchive(row)}
                          disabled={archivingId === row.id}
                        >
                          <Archive className="mr-2 size-3" />
                          {archivingId === row.id ? 'Archiving…' : 'Archive'}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setConfirmDeleteRow(row)}
                        disabled={deletingId === row.id}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 size-3" />
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
      <AlertDialog
        open={Boolean(confirmDeleteRow)}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDeleteRow(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete channel?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the channel and its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDeleteRow) {
                  void handleDelete(confirmDeleteRow);
                }
              }}
              disabled={Boolean(deletingId)}
            >
              {deletingId ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
