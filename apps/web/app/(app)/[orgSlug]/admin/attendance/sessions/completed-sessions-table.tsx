import type { AdminSessionCompletionVM } from '@iconicedu/shared-types';
import {
  Badge,
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
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Session</TableHead>
            <TableHead>Classroom</TableHead>
            <TableHead>Ended</TableHead>
            <TableHead>Students</TableHead>
            <TableHead>Confirmed by</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Rating</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                No completed sessions match the selected filters.
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">
                {row.sessionTitle ?? 'Scheduled session'}
              </TableCell>
              <TableCell>{row.learningSpaceTitle ?? '—'}</TableCell>
              <TableCell>{formatAttendanceDateTime(row.sessionEndAt)}</TableCell>
              <TableCell>{row.studentNames.join(', ') || '—'}</TableCell>
              <TableCell>
                {row.confirmedBy.length === 0
                  ? '—'
                  : row.confirmedBy
                      .map((actor) => `${actor.displayName} (${actor.role})`)
                      .join(', ')}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="capitalize">
                  {row.completionMethod.replace('_', ' ')}
                </Badge>
              </TableCell>
              <TableCell>
                {row.averageRating == null ? '—' : `${row.averageRating.toFixed(1)} / 5`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
