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
        toast.error(payload.message ?? 'Unable to delete class.');
        return;
      }
      toast.success('Class deleted.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete class.');
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
        toast.error(payload.message ?? 'Unable to archive class.');
        return;
      }
      toast.success('Class archived.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to archive class.');
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
        toast.error(payload.message ?? 'Unable to unarchive class.');
        return;
      }
      toast.success('Class restored.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to unarchive class.');
    } finally {
      setUnarchivingId(null);
    }
  };

  const handleEdit = (row: AdminLearningSpaceRow) => {
    onEdit(row);
  };

  return (
    <div className="w-full border-y border-border bg-card">
      <Table className="min-w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[32rem] whitespace-normal">Title</TableHead>
            <TableHead>Participants</TableHead>
            <TableHead>Schedule</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="border-b border-border/60 last:border-b-0">
              <TableCell className="w-[32rem] whitespace-normal align-top">
                {(() => {
                  const TitleIcon = getLearningSpaceIcon(row.icon_key);
                  return (
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-full border border-border bg-muted">
                        <TitleIcon className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {row.primaryChannelId ? (
                          <Link
                            href={`${dashboardBasePath}/spaces/${row.primaryChannelId}`}
                            className="text-sm font-semibold hover:underline whitespace-normal break-words"
                          >
                            {row.title}
                          </Link>
                        ) : (
                          <p className="text-sm font-semibold whitespace-normal break-words">
                            {row.title}
                          </p>
                        )}
                        {row.description && (
                          <p className="text-xs text-muted-foreground whitespace-normal break-words">
                            {row.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </TableCell>
              <TableCell>
                {row.participantDetails.length ? (
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
                              themeKey={(participant.themeKey as ThemeKey | null) ?? null}
                              showStatus={false}
                              sizeClassName="size-8"
                              initialsLength={1}
                            />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs font-medium">{participant.displayName}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {participant.kind}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </AvatarGroup>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </TableCell>
              <TableCell>
                {row.scheduleItems?.length ? (
                  <div className="text-sm text-muted-foreground space-y-1">
                    {row.scheduleSummary && (
                      <p className="font-medium text-foreground">{row.scheduleSummary}</p>
                    )}
                    <ul className="list-disc pl-4 space-y-1">
                      {row.scheduleItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    row.status === 'active'
                      ? 'secondary'
                      : row.status === 'archived'
                        ? 'outline'
                        : 'ghost'
                  }
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
            <AlertDialogTitle>Delete class?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the class, its channels, and schedules.
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
