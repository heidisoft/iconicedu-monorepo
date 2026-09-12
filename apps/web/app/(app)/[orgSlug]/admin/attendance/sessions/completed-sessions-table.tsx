'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  Clock,
  CircleAlert,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { toUtcFromLocal } from '@iconicedu/utils';
import { getCompletionParticipants } from './session-attendance-analytics';
import type {
  AdminSessionCompletionParticipantVM,
  AdminSessionCompletionVM,
} from '@iconicedu/shared-types';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
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
  toast,
} from '@iconicedu/ui-web';
import {
  formatAttendanceDateTime,
  formatAttendanceDuration,
} from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/live-session-attendance.utils';
import type { ScheduleOptionRow } from '@iconicedu/web/lib/api/schedules';

const PAGE_SIZE = 10;

// Scheduled length of the occurrence: end minus its start (occurrenceKey). Returns
// null when either bound is unparseable or non-positive — some backfilled rows
// carry no distinct end time, so end === start.
function getSessionDurationSeconds(row: AdminSessionCompletionVM) {
  const start = new Date(row.occurrenceKey).getTime();
  const end = new Date(row.sessionEndAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }
  return (end - start) / 1000;
}

// Lets an admin backfill a session that has no completion-check trail at all
// (e.g. the dispatcher never ran for it) — creates a full 'pending' row per
// tutor/parent/student on the chosen classroom's own roster, same as a normal
// live-dispatched session, so the real participants confirm/dispute it
// themselves rather than the admin asserting an outcome on their behalf.
function CreateSessionDialog({
  orgId,
  schedules,
}: {
  orgId: string;
  schedules: ScheduleOptionRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [scheduleId, setScheduleId] = React.useState('');
  const formRef = React.useRef<HTMLFormElement | null>(null);

  const activeSchedules = schedules.filter((schedule) => schedule.status !== 'cancelled');

  const handleOpenChange = (next: boolean) => {
    if (isSubmitting) return;
    setOpen(next);
    if (!next) {
      formRef.current?.reset();
      setScheduleId('');
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const date = String(formData.get('date') ?? '');
    const startTime = String(formData.get('startTime') ?? '');
    const endTime = String(formData.get('endTime') ?? '');
    const schedule = schedules.find((candidate) => candidate.id === scheduleId);

    if (!schedule) {
      toast.error('Choose a classroom');
      return;
    }

    const timezone = schedule.timezone ?? 'UTC';
    const occurrenceKey = toUtcFromLocal(date, startTime, timezone);
    const sessionEndAt = toUtcFromLocal(date, endTime, timezone);
    if (!occurrenceKey || !sessionEndAt) {
      toast.error('Enter a valid date, start time, and end time');
      return;
    }
    if (Date.parse(sessionEndAt) <= Date.parse(occurrenceKey)) {
      toast.error('End time must be after the start time');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/session-completions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          scheduleId: schedule.id,
          occurrenceKey,
          sessionEndAt,
        }),
      });
      const result = await response.json();
      if (!result?.success) {
        throw new Error(result?.message ?? 'Unable to create session.');
      }
      if (!result.createdCount) {
        toast.error('That session already has records for every participant.');
      } else {
        toast.success(
          result.skippedCount
            ? `Created ${result.createdCount} record(s); ${result.skippedCount} already existed`
            : `Created ${result.createdCount} record(s), awaiting confirmation`,
        );
        handleOpenChange(false);
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create session.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" type="button">
          <Plus className="mr-1.5 size-3.5" />
          Add session
        </Button>
      </DialogTrigger>
      <DialogContent className="space-y-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a session manually</DialogTitle>
          <DialogDescription>
            Use this when a session happened but never got a completion record — e.g. the
            automatic check never ran for it. Creates a pending record for every tutor,
            parent, and student on the classroom&apos;s roster so they can confirm it
            themselves.
          </DialogDescription>
        </DialogHeader>
        <form
          ref={formRef}
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-4"
        >
          <div className="space-y-1">
            <Label htmlFor="create-session-classroom">Classroom</Label>
            <Select
              value={scheduleId}
              onValueChange={setScheduleId}
              disabled={isSubmitting}
            >
              <SelectTrigger id="create-session-classroom" className="w-full">
                <SelectValue placeholder="Select a classroom" />
              </SelectTrigger>
              <SelectContent>
                {activeSchedules.map((schedule) => (
                  <SelectItem key={schedule.id} value={schedule.id}>
                    {schedule.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-session-date">Session date</Label>
            <Input
              id="create-session-date"
              name="date"
              type="date"
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="create-session-start">Start time</Label>
              <Input
                id="create-session-start"
                name="startTime"
                type="time"
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="create-session-end">End time</Label>
              <Input
                id="create-session-end"
                name="endTime"
                type="time"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || !scheduleId}>
              {isSubmitting ? 'Creating…' : 'Create session'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CompletedSessionsTable({
  rows,
  schedules,
  orgId,
}: {
  rows: AdminSessionCompletionVM[];
  schedules: ScheduleOptionRow[];
  orgId: string;
}) {
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);

  // Filters upstream replace `rows` with a new array, so reset back to page 1
  // whenever the underlying result set changes rather than stranding the user
  // on a page that may no longer exist.
  React.useEffect(() => {
    setPage(1);
  }, [rows]);

  // Once staff confirms, every participant row for the occurrence flips to
  // 'confirmed' server-side, so this stops offering the action and the
  // teacher/parent's own confirm prompt stops resurfacing for it too.
  const handleStaffConfirm = async (row: AdminSessionCompletionVM) => {
    if (confirmingId) return;
    setConfirmingId(row.id);
    try {
      const response = await fetch('/api/admin/session-completions/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: row.orgId,
          scheduleId: row.scheduleId,
          occurrenceKey: row.occurrenceKey,
        }),
      });
      const result = await response.json();
      if (!result?.success) {
        throw new Error(result?.message ?? 'Unable to confirm session.');
      }
      toast.success('Session confirmed');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to confirm session.');
    } finally {
      setConfirmingId(null);
    }
  };

  // Removes a wrong entry rather than resolving a real one: either one
  // participant's submission (person given) or the whole occurrence's rows
  // (person omitted), for cleaning up bad data (e.g. an erroneous backfill).
  const [pendingDelete, setPendingDelete] = React.useState<{
    row: AdminSessionCompletionVM;
    person: AdminSessionCompletionParticipantVM | null;
  } | null>(null);
  const [deletingKey, setDeletingKey] = React.useState<string | null>(null);

  const handleDeleteSubmission = async () => {
    if (!pendingDelete || deletingKey) return;
    const { row, person } = pendingDelete;
    const key = `${row.id}|${person?.profileId ?? 'all'}`;
    setDeletingKey(key);
    try {
      const response = await fetch('/api/admin/session-completions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: row.orgId,
          scheduleId: row.scheduleId,
          occurrenceKey: row.occurrenceKey,
          profileId: person?.profileId,
        }),
      });
      const result = await response.json();
      if (!result?.success) {
        throw new Error(result?.message ?? 'Unable to delete submission.');
      }
      toast.success(person ? 'Submission deleted' : 'Session entry deleted');
      setPendingDelete(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to delete submission.',
      );
    } finally {
      setDeletingKey(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-end border-b px-4 py-3">
        <CreateSessionDialog orgId={orgId} schedules={schedules} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Session</TableHead>
            <TableHead>Ended</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Students</TableHead>
            <TableHead>Confirmed by</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                No completed sessions match the selected filters.
              </TableCell>
            </TableRow>
          )}
          {pageRows.map((row) => {
            const participants = getCompletionParticipants(row);
            const hasDispute = participants.some(
              (person) => person.status === 'disputed',
            );
            const needsConfirmation = participants.some(
              (person) => person.status !== 'confirmed',
            );
            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {row.sessionTitle ?? 'Scheduled session'}
                </TableCell>
                <TableCell>{formatAttendanceDateTime(row.sessionEndAt)}</TableCell>
                <TableCell>
                  {formatAttendanceDuration(getSessionDurationSeconds(row))}
                </TableCell>
                <TableCell>{row.studentNames.join(', ') || '—'}</TableCell>
                <TableCell>
                  <ul className="space-y-2">
                    {participants.map((person) => {
                      const confirmed = person.status === 'confirmed';
                      const disputed = person.status === 'disputed';
                      const Icon = confirmed ? Check : disputed ? CircleAlert : Clock;
                      const status = confirmed
                        ? 'Confirmed'
                        : disputed
                          ? 'Disputed'
                          : person.status === 'auto_confirmed'
                            ? 'Auto-confirmed; awaiting personal confirmation'
                            : 'Pending';
                      return (
                        <li
                          key={`${person.role}|${person.profileId}`}
                          className="flex items-start gap-2"
                        >
                          <Icon
                            aria-hidden="true"
                            className={`mt-0.5 size-4 shrink-0 ${confirmed ? 'text-primary' : 'text-muted-foreground'}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p>
                              {person.displayName}{' '}
                              <span className="text-xs text-muted-foreground">
                                ({person.role === 'educator' ? 'Tutor' : 'Parent'}) ·{' '}
                                {status}
                              </span>
                            </p>
                            {person.rating != null && (
                              <p className="text-xs text-muted-foreground">
                                Rating: {person.rating.toFixed(1)} / 5
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                            aria-label={`Delete ${person.displayName}'s submission`}
                            title="Delete this submission"
                            onClick={() => setPendingDelete({ row, person })}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                  {participants.length === 0 && '—'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {hasDispute ? (
                      <span className="text-xs text-muted-foreground">
                        Dispute reported
                      </span>
                    ) : needsConfirmation ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={confirmingId === row.id}
                        onClick={() => void handleStaffConfirm(row)}
                      >
                        {confirmingId === row.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          'Confirm'
                        )}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Confirmed</span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      aria-label="Delete this session entry"
                      title="Delete this session entry (wrong submission)"
                      onClick={() => setPendingDelete({ row, person: null })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {rows.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–
            {Math.min(currentPage * PAGE_SIZE, rows.length)} of {rows.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={currentPage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open && !deletingKey) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete?.person
                ? `Delete ${pendingDelete.person.displayName}'s submission?`
                : 'Delete this session entry?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.person
                ? "This permanently removes this person's confirmation/rating for this session. Use this only to clean up a wrong or erroneous entry."
                : 'This permanently removes every submission for this session occurrence. Use this only to clean up a wrong or erroneous entry.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingKey)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={Boolean(deletingKey)}
              onClick={() => void handleDeleteSubmission()}
            >
              {deletingKey ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
