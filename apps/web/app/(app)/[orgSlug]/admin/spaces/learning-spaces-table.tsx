'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CalendarDays,
  CheckCircle2,
  CircleDot,
  PauseCircle,
  RefreshCw,
} from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@iconicedu/ui-web/ui/tooltip';
import { AvatarWithStatus } from '@iconicedu/ui-web/components/shared/avatar-with-status';
import { getLearningSpaceIcon } from '@iconicedu/ui-web/lib/icons';
import type { ThemeKey } from '@iconicedu/shared-types';

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

  return (
    <div className="w-full border-y border-border bg-card">
      <Table className="min-w-full table-auto">
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-normal">Title</TableHead>
            <TableHead className="whitespace-normal">Schedule</TableHead>
            <TableHead className="whitespace-nowrap">Updated</TableHead>
            <TableHead className="whitespace-nowrap">Status</TableHead>
            <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="border-b border-border/60 last:border-b-0">
              <TableCell className="whitespace-normal align-top">
                {(() => {
                  const TitleIcon = getLearningSpaceIcon(row.icon_key);
                  return (
                    <div className="flex items-start gap-2">
                      <div className="flex size-8 items-center justify-center rounded-full border border-border bg-muted">
                        <TitleIcon className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {row.primaryChannelId ? (
                          <Link
                            href={`${dashboardBasePath}/spaces/${row.primaryChannelId}`}
                            className="text-sm font-medium hover:underline whitespace-normal break-words"
                          >
                            {row.title}
                          </Link>
                        ) : (
                          <p className="text-sm font-medium whitespace-normal break-words">
                            {row.title}
                          </p>
                        )}
                        {row.description && (
                          <p className="text-xs text-muted-foreground whitespace-normal break-words line-clamp-2">
                            {row.description}
                          </p>
                        )}
                        {row.participantDetails.length ? (
                          <ul className="my-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                            {row.participantDetails.map((participant) => (
                              <li
                                key={participant.id}
                                className="flex items-center gap-1.5 px-1.5 first:pl-0"
                              >
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex">
                                      <AvatarWithStatus
                                        name={participant.displayName}
                                        avatar={{
                                          source: participant.avatarUrl
                                            ? 'upload'
                                            : 'seed',
                                          url: participant.avatarUrl ?? null,
                                        }}
                                        themeKey={
                                          (participant.themeKey as ThemeKey | null) ??
                                          null
                                        }
                                        showStatus={false}
                                        sizeClassName="size-5"
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
                                <span className="text-[11px] text-foreground">
                                  {participant.displayName}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                  );
                })()}
              </TableCell>
              <TableCell className="align-top">
                {row.scheduleItems?.length ? (
                  <div className="text-xs text-muted-foreground">
                    <ul className="space-y-2">
                      {row.scheduleItems.map((item, index) => (
                        <li
                          key={`${row.id}-schedule-${index}`}
                          className="space-y-1 break-words leading-5"
                        >
                          {index > 0 ? (
                            <>
                              <p className="text-muted-foreground/50">---</p>
                            </>
                          ) : null}
                          <div className="flex items-center gap-2">
                            {item.kind === 'none' ? (
                              <CalendarDays className="size-3.5 text-muted-foreground" />
                            ) : (
                              <RefreshCw className="size-3.5 text-muted-foreground" />
                            )}
                            <p>{item.summary}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap align-top">
                <div className="text-xs leading-5">
                  <p className="text-foreground">
                    {new Date(row.updated_at ?? row.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-muted-foreground">
                    by {row.updatedByDisplayName ?? 'Unknown'}
                  </p>
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap align-top">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      {row.status === 'active' ? (
                        <CheckCircle2 className="size-4 text-emerald-600" />
                      ) : row.status === 'archived' ? (
                        <Archive className="size-4 text-muted-foreground" />
                      ) : row.status === 'paused' ? (
                        <PauseCircle className="size-4 text-amber-600" />
                      ) : row.status === 'completed' ? (
                        <CheckCircle2 className="size-4 text-blue-600" />
                      ) : (
                        <CircleDot className="size-4 text-muted-foreground" />
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs capitalize">{row.status}</p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell className="whitespace-nowrap text-right align-top">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="px-2">
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
