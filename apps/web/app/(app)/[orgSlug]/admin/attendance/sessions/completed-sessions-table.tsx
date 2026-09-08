import { Check, Clock, CircleAlert } from 'lucide-react';
import { getCompletionParticipants } from './session-attendance-analytics';
import type { AdminSessionCompletionVM } from '@iconicedu/shared-types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@iconicedu/ui-web';
import { formatAttendanceDateTime } from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/live-session-attendance.utils';

export function CompletedSessionsTable({ rows }: { rows: AdminSessionCompletionVM[] }) {
  return (
    <div className="w-full min-w-0 overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Session</TableHead>
            <TableHead>Ended</TableHead>
            <TableHead>Students</TableHead>
            <TableHead>Confirmed by</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                No completed sessions match the selected filters.
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">
                {row.sessionTitle ?? 'Scheduled session'}
              </TableCell>
              <TableCell>{formatAttendanceDateTime(row.sessionEndAt)}</TableCell>
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
    </div>
  );
}
