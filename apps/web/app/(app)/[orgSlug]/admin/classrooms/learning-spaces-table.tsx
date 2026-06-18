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
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Pencil,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Trash2,
  toast,
} from '@iconicedu/ui-web';
import { ThemedIconBadge } from '@iconicedu/ui-web/components/shared/themed-icon';
import { getLearningSpaceIcon } from '@iconicedu/ui-web/lib/icons';
import { cn } from '@iconicedu/ui-web/lib/utils';

import type { AdminLearningSpaceRow } from '@iconicedu/web/lib/admin/learning-spaces';

type LearningSpacesTableProps = {
  rows: AdminLearningSpaceRow[];
  onEdit: (row: AdminLearningSpaceRow) => void;
};

export function LearningSpacesTable({ rows, onEdit }: LearningSpacesTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const dashboardBasePath = React.useMemo(() => {
    const firstSegment = pathname?.split('/').filter(Boolean)[0];
    if (!firstSegment) {
      return '/';
    }
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

  const handleEdit = (row: AdminLearningSpaceRow) => {
    onEdit(row);
  };

  const renderScheduleItems = (row: AdminLearningSpaceRow) => {
    if (!row.scheduleItems?.length) {
      return <span className="text-sm text-muted-foreground">—</span>;
    }

    return (
      <div className="space-y-3">
        {row.scheduleItems.map((item, index) => {
          const [frequencyLabel, ...detailParts] = item.summary
            .split(' · ')
            .map((part) => part.trim())
            .filter(Boolean);
          const timeRange =
            detailParts.length > 0 ? (detailParts[detailParts.length - 1] ?? '') : '';
          const detailLabel = detailParts.slice(0, -1).join(' · ') || 'Scheduled';

          return (
            <div
              key={`${row.id}-schedule-${index}`}
              className={
                index === 0 ? 'space-y-2' : 'space-y-2 border-t border-border/60 pt-3'
              }
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge variant="secondary" className="text-xs">
                  {frequencyLabel}
                </Badge>
                <span className="text-sm text-foreground">{detailLabel}</span>
              </div>
              {timeRange ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock3 className="size-4 shrink-0" />
                  <span>{timeRange}</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  const renderStatusBadge = (status: string) => {
    const normalized = status.toLowerCase();
    const className =
      normalized === 'active'
        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
        : normalized === 'pending' || normalized === 'paused'
          ? 'bg-amber-100 text-amber-700 hover:bg-amber-100'
          : normalized === 'archived'
            ? 'bg-muted text-muted-foreground hover:bg-muted'
            : normalized === 'completed'
              ? 'bg-blue-100 text-blue-700 hover:bg-blue-100'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary';

    return <Badge className={`text-xs capitalize ${className}`}>{status}</Badge>;
  };

  const renderParticipantNames = (row: AdminLearningSpaceRow) => {
    if (!row.participantDetails.length) {
      return null;
    }

    return (
      <p className="line-clamp-2 text-xs text-muted-foreground">
        {row.participantDetails.map((participant, index) => {
          const hasTheme = Boolean(participant.themeKey);
          return (
            <React.Fragment key={participant.id}>
              {index > 0 ? <span className="text-muted-foreground">, </span> : null}
              <span
                className={cn(hasTheme ? `theme-${participant.themeKey}` : '')}
                style={hasTheme ? { color: 'var(--theme-bg)' } : undefined}
              >
                {participant.displayName}
              </span>
            </React.Fragment>
          );
        })}
      </p>
    );
  };

  return (
    <div className="w-full overflow-x-auto">
      <Table className="min-w-[860px] table-fixed lg:min-w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50%] px-3 sm:px-4 lg:px-6">Title</TableHead>
            <TableHead className="w-[26%] px-3 sm:px-4 lg:px-6">Schedule</TableHead>
            <TableHead className="w-[10%] px-3 sm:px-4 lg:px-6">Updated</TableHead>
            <TableHead className="w-[8%] px-3 sm:px-4 lg:px-6">Status</TableHead>
            <TableHead className="w-[6%] px-3 text-right sm:px-4 lg:px-6">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="border-b border-border/60 last:border-b-0">
              <TableCell className="px-3 py-4 align-middle sm:px-4 sm:py-5 lg:px-6 lg:py-6">
                {(() => {
                  const TitleIcon = getLearningSpaceIcon(row.icon_key);
                  return (
                    <div className="flex items-start gap-3 sm:gap-4">
                      <ThemedIconBadge
                        icon={TitleIcon}
                        themeKey={row.themeKey ?? null}
                        size="md"
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        {row.primaryChannelId ? (
                          <Link
                            href={`${dashboardBasePath}/s/${row.primaryChannelId}`}
                            className="line-clamp-2 text-sm font-semibold leading-tight hover:underline"
                          >
                            {row.title}
                          </Link>
                        ) : (
                          <p className="line-clamp-2 text-sm font-semibold leading-tight">
                            {row.title}
                          </p>
                        )}
                        {(row.subject ||
                          row.description ||
                          row.participantDetails.length > 0) && (
                          <div className="mt-1 space-y-1">
                            {row.subject || row.description ? (
                              <p className="line-clamp-2 text-xs text-muted-foreground">
                                {row.subject ?? row.description}
                              </p>
                            ) : null}
                            {renderParticipantNames(row)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </TableCell>
              <TableCell className="px-3 py-4 align-middle sm:px-4 sm:py-5 lg:px-6 lg:py-6">
                <div className="min-w-0">{renderScheduleItems(row)}</div>
              </TableCell>
              <TableCell className="px-3 py-4 align-middle sm:px-4 sm:py-5 lg:px-6 lg:py-6">
                <div className="space-y-1">
                  <p className="text-sm text-foreground">
                    {new Date(row.updated_at ?? row.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Updated by {row.updatedByDisplayName ?? 'Unknown'}
                  </p>
                </div>
              </TableCell>
              <TableCell className="px-3 py-4 align-middle sm:px-4 sm:py-5 lg:px-6 lg:py-6">
                {renderStatusBadge(row.status)}
              </TableCell>
              <TableCell className="px-3 py-4 text-right align-middle sm:px-4 sm:py-5 lg:px-6 lg:py-6">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 rounded-full p-0"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(row)}>
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
          ))}
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
            <AlertDialogTitle>Delete classroom?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the classroom, its channels, and schedules.
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
