'use client';

import * as React from 'react';
import { Check, Clock, CircleAlert, ChevronLeft, ChevronRight } from 'lucide-react';
import { getCompletionParticipants } from './session-attendance-analytics';
import type { AdminSessionCompletionVM } from '@iconicedu/shared-types';
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@iconicedu/ui-web';
import {
  formatAttendanceDateTime,
  formatAttendanceDuration,
} from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/live-session-attendance.utils';

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

export function CompletedSessionsTable({ rows }: { rows: AdminSessionCompletionVM[] }) {
  const [page, setPage] = React.useState(1);

  // Filters upstream replace `rows` with a new array, so reset back to page 1
  // whenever the underlying result set changes rather than stranding the user
  // on a page that may no longer exist.
  React.useEffect(() => {
    setPage(1);
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Session</TableHead>
            <TableHead>Ended</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Students</TableHead>
            <TableHead>Confirmed by</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                No completed sessions match the selected filters.
              </TableCell>
            </TableRow>
          )}
          {pageRows.map((row) => (
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
                  {getCompletionParticipants(row).map((person) => {
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
                        <div>
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
                      </li>
                    );
                  })}
                </ul>
                {getCompletionParticipants(row).length === 0 && '—'}
              </TableCell>
            </TableRow>
          ))}
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
    </div>
  );
}
