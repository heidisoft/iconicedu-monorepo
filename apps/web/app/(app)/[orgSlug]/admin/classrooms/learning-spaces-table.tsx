'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock3 } from 'lucide-react';
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
import { ThemedIconBadge } from '@iconicedu/ui-web/components/shared/themed-icon';
import { getLearningSpaceIcon } from '@iconicedu/ui-web/lib/icons';

import type { AdminLearningSpaceRow } from '@iconicedu/web/lib/admin/learning-spaces';

const SCHEDULE_COLLAPSED_LIMIT = 2;

type LearningSpacesTableProps = {
  rows: AdminLearningSpaceRow[];
  orgSlug: string;
};

function MemberChip({
  participant,
}: {
  participant: AdminLearningSpaceRow['participantDetails'][number];
}) {
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

function ScheduleChip({ summary }: { summary: string }) {
  const parts = summary
    .split(' · ')
    .map((p) => p.trim())
    .filter(Boolean);
  const label = parts.slice(0, -1).join(' · ') || summary;
  const time = parts.length > 1 ? parts[parts.length - 1] : null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-foreground">
      <Clock3 className="size-3 shrink-0 text-muted-foreground" />
      <span>{label}</span>
      {time && <span className="text-muted-foreground">· {time}</span>}
    </span>
  );
}

function ScheduleList({ row }: { row: AdminLearningSpaceRow }) {
  const [expanded, setExpanded] = React.useState(false);

  if (!row.scheduleItems?.length) {
    return <span className="text-xs text-muted-foreground">No schedule</span>;
  }

  const visible = expanded
    ? row.scheduleItems
    : row.scheduleItems.slice(0, SCHEDULE_COLLAPSED_LIMIT);
  const overflow = row.scheduleItems.length - SCHEDULE_COLLAPSED_LIMIT;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((item, i) => (
        <ScheduleChip key={i} summary={item.summary} />
      ))}
      {!expanded && overflow > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
        >
          +{overflow} more
        </button>
      )}
      {expanded && overflow > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
}

export function LearningSpacesTable({ rows, orgSlug }: LearningSpacesTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const dashboardBasePath = React.useMemo(() => {
    const firstSegment = pathname?.split('/').filter(Boolean)[0];
    if (!firstSegment) return '/';
    return `/${firstSegment}`;
  }, [pathname]);

  const [confirmDeleteRow, setConfirmDeleteRow] =
    React.useState<AdminLearningSpaceRow | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [archivingId, setArchivingId] = React.useState<string | null>(null);
  const [unarchivingId, setUnarchivingId] = React.useState<string | null>(null);

  const handleDelete = async (row: AdminLearningSpaceRow) => {
    setDeletingId(row.id);
    try {
      const response = await fetch('/api/admin/spaces/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learningSpaceId: row.id }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        toast.error(payload.message ?? 'Unable to delete classroom.');
        return;
      }
      toast.success('Classroom deleted.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete classroom.');
    } finally {
      setDeletingId(null);
      setConfirmDeleteRow(null);
    }
  };

  const handleArchive = async (row: AdminLearningSpaceRow) => {
    setArchivingId(row.id);
    try {
      const response = await fetch('/api/admin/spaces/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learningSpaceId: row.id }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        toast.error(payload.message ?? 'Unable to archive classroom.');
        return;
      }
      toast.success('Classroom archived.');
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to archive classroom.',
      );
    } finally {
      setArchivingId(null);
    }
  };

  const handleUnarchive = async (row: AdminLearningSpaceRow) => {
    setUnarchivingId(row.id);
    try {
      const response = await fetch('/api/admin/spaces/unarchive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learningSpaceId: row.id }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        toast.error(payload.message ?? 'Unable to unarchive classroom.');
        return;
      }
      toast.success('Classroom restored.');
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to unarchive classroom.',
      );
    } finally {
      setUnarchivingId(null);
    }
  };

  if (!rows.length) {
    return (
      <p className="px-6 py-10 text-center text-sm text-muted-foreground">
        No classrooms found.
      </p>
    );
  }

  return (
    <div className="w-full">
      {rows.map((row) => {
        const TitleIcon = getLearningSpaceIcon(row.icon_key);
        return (
          <div
            key={row.id}
            className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border/60 last:border-b-0 hover:bg-muted/30 transition-colors"
          >
            {/* Left: icon + title + schedules + participants */}
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="shrink-0">
                <ThemedIconBadge
                  icon={TitleIcon}
                  themeKey={row.themeKey ?? null}
                  size="md"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {row.primaryChannelId ? (
                    <Link
                      href={`${dashboardBasePath}/s/${row.primaryChannelId}`}
                      className="text-base font-semibold leading-tight hover:underline"
                    >
                      {row.title}
                    </Link>
                  ) : (
                    <span className="text-base font-semibold leading-tight">
                      {row.title}
                    </span>
                  )}
                  {row.subject && (
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground font-normal">
                      {row.subject}
                    </span>
                  )}
                </div>

                <div className="mt-1.5">
                  <ScheduleList row={row} />
                </div>

                {row.participantDetails.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {row.participantDetails.map((p) => (
                      <MemberChip key={p.id} participant={p} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex shrink-0 flex-wrap justify-end gap-1.5 pt-0.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label={`Edit ${row.title}`}
                title="Edit classroom"
                onClick={() => router.push(`/${orgSlug}/admin/classrooms/${row.id}`)}
              >
                <Pencil className="size-4" />
              </Button>
              {row.status === 'archived' ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label={`Unarchive ${row.title}`}
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
                  aria-label={`Archive ${row.title}`}
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
                aria-label={`Delete ${row.title}`}
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
            <AlertDialogTitle>Delete classroom?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the classroom, its channels, and schedules.
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
