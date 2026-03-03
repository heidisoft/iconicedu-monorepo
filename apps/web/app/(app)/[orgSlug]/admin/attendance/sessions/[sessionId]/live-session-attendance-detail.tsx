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
  formatAttendancePercent,
  getParticipantAttendanceTone,
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
          <div>Expected: {detail.session.metrics.expectedParticipantCount}</div>
          <div>Attendees: {detail.session.metrics.attendeeCount}</div>
          <div>Full attendance: {detail.session.metrics.fullAttendanceCount}</div>
          <div>Partial attendance: {detail.session.metrics.partialAttendanceCount}</div>
          <div>No-show: {detail.session.metrics.noShowCount}</div>
          <div>Full threshold: {detail.policy.fullAttendanceThresholdPercent}%</div>
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
              <TableHead>Expected</TableHead>
              <TableHead>First joined</TableHead>
              <TableHead>Last left</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Required</TableHead>
              <TableHead>Attendance</TableHead>
              <TableHead>Joins</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.participants.map((row) => (
              <TableRow key={row.ids.id}>
                <TableCell>{row.participant?.profile.displayName ?? 'Unknown user'}</TableCell>
                <TableCell className="capitalize">{row.participant?.kind ?? 'unknown'}</TableCell>
                <TableCell>{row.expectedToAttend ? 'Yes' : 'No'}</TableCell>
                <TableCell>{formatAttendanceDateTime(row.firstJoinedAt)}</TableCell>
                <TableCell>{formatAttendanceDateTime(row.lastLeftAt)}</TableCell>
                <TableCell>{formatAttendanceDuration(row.creditedSeconds ?? row.totalSeconds)}</TableCell>
                <TableCell>{formatAttendanceDuration(row.requiredSeconds)}</TableCell>
                <TableCell>{formatAttendancePercent(row.attendanceRatio)}</TableCell>
                <TableCell>{row.joinCount}</TableCell>
                <TableCell>
                  <Badge variant={getParticipantAttendanceTone(row.attendanceStatus)} className="capitalize">
                    {row.attendanceStatus.replace('_', ' ')}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {detail.timeline?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.timeline.map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-4 text-sm">
                <div className="flex flex-col gap-1">
                  <span className="font-medium capitalize text-foreground">
                    {event.eventType.replace(/_/g, ' ')}
                  </span>
                  <span className="text-muted-foreground">
                    {event.participantDisplayName ?? event.providerParticipantId ?? 'System'}
                  </span>
                </div>
                <div className="text-right text-muted-foreground">
                  <div>{formatAttendanceDateTime(event.occurredAt)}</div>
                  <div className="capitalize">{event.source.replace('_', ' ')}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
