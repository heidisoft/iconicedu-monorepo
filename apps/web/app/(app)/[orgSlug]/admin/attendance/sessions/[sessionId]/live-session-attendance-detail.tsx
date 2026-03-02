import type { LiveSessionAttendanceDetailVM } from '@iconicedu/shared-types';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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

type LiveSessionAttendanceDetailProps = {
  detail: LiveSessionAttendanceDetailVM;
};

export function LiveSessionAttendanceDetail({ detail }: LiveSessionAttendanceDetailProps) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{detail.session.learningSpaceTitle ?? detail.session.channelTopic}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
          <div>Channel: {detail.session.channelTopic}</div>
          <div>Provider: <span className="capitalize">{detail.session.provider}</span></div>
          <div>Started: {formatAttendanceDateTime(detail.session.startedAt)}</div>
          <div>Ended: {formatAttendanceDateTime(detail.session.endedAt)}</div>
          <div>Duration: {formatAttendanceDuration(detail.session.metrics.durationSeconds)}</div>
          <div>Starter: {detail.session.startedBy?.profile.displayName ?? 'System'}</div>
          <div>
            Status:{' '}
            <Badge variant={detail.session.status === 'failed' ? 'destructive' : 'secondary'} className="capitalize">
              {detail.session.status}
            </Badge>
          </div>
          <div>Scope: {detail.session.scope}</div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border bg-card">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead>Participant</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Attended</TableHead>
              <TableHead>First joined</TableHead>
              <TableHead>Last left</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Joins</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.participants.map((row) => (
              <TableRow key={row.ids.id}>
                <TableCell>{row.participant?.profile.displayName ?? 'Unknown user'}</TableCell>
                <TableCell className="capitalize">{row.participant?.kind ?? 'unknown'}</TableCell>
                <TableCell>{row.attended ? 'Yes' : 'No'}</TableCell>
                <TableCell>{formatAttendanceDateTime(row.firstJoinedAt)}</TableCell>
                <TableCell>{formatAttendanceDateTime(row.lastLeftAt)}</TableCell>
                <TableCell>{formatAttendanceDuration(row.totalSeconds)}</TableCell>
                <TableCell>{row.joinCount}</TableCell>
                <TableCell className="capitalize">{row.lastKnownStatus}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
