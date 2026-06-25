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
  Button,
  Archive,
  ArchiveRestore,
  Pencil,
  Trash2,
  toast,
} from '@iconicedu/ui-web';
import { Avatar, AvatarFallback, AvatarImage } from '@iconicedu/ui-web/ui/avatar';
import { getLearningSpaceIcon } from '@iconicedu/ui-web/lib/icons';

import type {
  AdminChannelRow,
  ChannelParticipantDetail,
} from '@iconicedu/web/lib/admin/channels';

type ChannelsTableProps = {
  rows: AdminChannelRow[];
  orgSlug: string;
};

function resolveDashboardBasePath(pathname: string | null): string {
  const firstSegment = pathname?.split('/').filter(Boolean)[0];
  if (!firstSegment) return '/';
  return `/${firstSegment}`;
}

function getChannelHref(row: AdminChannelRow, dashboardBasePath: string) {
  const isLearningSpace =
    row.purpose === 'learning-space' || row.primary_entity_kind === 'learning_space';
  return isLearningSpace
    ? `${dashboardBasePath}/s/${row.id}`
    : `${dashboardBasePath}/c/${row.id}`;
}

function ChannelAvatar({ row }: { row: AdminChannelRow }) {
  const isLearningSpace =
    row.purpose === 'learning-space' || row.primary_entity_kind === 'learning_space';
  const themeKey = row.ui_theme_key ?? null;
  const themeClass = themeKey ? `theme-${themeKey}` : '';

  if ((row.kind === 'dm' || row.kind === 'group_dm') && row.participantDetails?.length) {
    const first = row.participantDetails[0];
    const participantThemeClass = first.themeKey ? `theme-${first.themeKey}` : '';
    return (
      <Avatar className={`size-14 shrink-0 ${participantThemeClass}`}>
        {first.avatarUrl ? (
          <AvatarImage src={first.avatarUrl} alt={first.displayName} />
        ) : null}
        <AvatarFallback
          className={participantThemeClass ? 'theme-bg theme-fg text-lg' : 'text-lg'}
        >
          {(first.displayName?.[0] ?? '?').toUpperCase()}
        </AvatarFallback>
      </Avatar>
    );
  }

  const Icon = isLearningSpace ? getLearningSpaceIcon(row.icon_key) : null;
  const initial = (row.topic?.[0] ?? '?').toUpperCase();

  return (
    <div
      className={`flex size-14 shrink-0 items-center justify-center rounded-full border ${themeClass || 'border-border bg-muted text-muted-foreground'}`}
      style={
        themeKey
          ? {
              backgroundColor:
                'color-mix(in oklab, var(--theme-bg) 15%, var(--muted) 85%)',
              color: 'var(--theme-bg)',
              borderColor: 'color-mix(in oklab, var(--theme-bg) 25%, transparent 75%)',
            }
          : undefined
      }
    >
      {Icon ? (
        <Icon className="size-6" aria-hidden />
      ) : (
        <span className="text-lg font-semibold">{initial}</span>
      )}
    </div>
  );
}

function MemberChip({ participant }: { participant: ChannelParticipantDetail }) {
  const themeClass = participant.themeKey ? `theme-${participant.themeKey}` : '';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-foreground">
      <Avatar className={`size-5 shrink-0 ${themeClass}`}>
        {participant.avatarUrl ? (
          <AvatarImage src={participant.avatarUrl} alt={participant.displayName} />
        ) : null}
        <AvatarFallback className={themeClass ? 'theme-bg theme-fg' : ''}>
          {(participant.displayName?.[0] ?? '?').toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="max-w-[120px] truncate">{participant.displayName}</span>
    </span>
  );
}

export function ChannelsTable({ rows, orgSlug }: ChannelsTableProps) {
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

  if (!rows.length) {
    return (
      <p className="px-6 py-10 text-center text-sm text-muted-foreground">
        No channels found.
      </p>
    );
  }

  return (
    <div className="w-full">
      {rows.map((row) => {
        return (
          <div
            key={row.id}
            className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border/60 last:border-b-0 hover:bg-muted/30 transition-colors"
          >
            {/* Left: avatar + name + chips */}
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <ChannelAvatar row={row} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={getChannelHref(row, dashboardBasePath)}
                    className="text-base font-semibold hover:underline"
                  >
                    {row.topic}
                  </Link>
                  <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground font-normal capitalize">
                    {row.purpose ?? row.kind}
                  </span>
                </div>
                {row.participantDetails?.length ? (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {row.participantDetails.map((p) => (
                      <MemberChip key={p.id} participant={p} />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label={`Edit ${row.topic}`}
                title="Edit channel"
                onClick={() => router.push(`/${orgSlug}/admin/channels/${row.id}`)}
              >
                <Pencil className="size-4" />
              </Button>
              {row.status === 'archived' ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label={`Unarchive ${row.topic}`}
                  title="Unarchive"
                  onClick={() => handleUnarchive(row)}
                  disabled={unarchivingId === row.id}
                >
                  <ArchiveRestore className="size-4" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label={`Archive ${row.topic}`}
                  title="Archive"
                  onClick={() => handleArchive(row)}
                  disabled={archivingId === row.id}
                >
                  <Archive className="size-4" />
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label={`Delete ${row.topic}`}
                title="Delete"
                onClick={() => setConfirmDeleteRow(row)}
                disabled={deletingId === row.id}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        );
      })}

      <AlertDialog
        open={Boolean(confirmDeleteRow)}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteRow(null);
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
                if (confirmDeleteRow) void handleDelete(confirmDeleteRow);
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
