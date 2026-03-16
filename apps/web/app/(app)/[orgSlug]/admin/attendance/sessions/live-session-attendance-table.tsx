'use client';

import Link from 'next/link';

import type { LiveSessionAttendanceListItemVM } from '@iconicedu/shared-types';
import {
  Badge,
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
  getAttendanceStatusTone,
} from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/live-session-attendance.utils';

type LiveSessionAttendanceTableProps = {
  orgSlug: string;
  rows: LiveSessionAttendanceListItemVM[];
};

export function LiveSessionAttendanceTable({
  orgSlug,
  rows,
}: LiveSessionAttendanceTableProps) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <Table className="min-w-full">
        <TableHeader>
          <TableRow>
            <TableHead>Session</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Ended</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Expected</TableHead>
            <TableHead>Attendees</TableHead>
            <TableHead>Full</TableHead>
            <TableHead>No-show</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">View</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.ids.id}>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-foreground">
                    {row.learningSpaceTitle ?? row.channelTopic}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {row.channelTopic}
                  </span>
                </div>
              </TableCell>
              <TableCell>{formatAttendanceDateTime(row.startedAt)}</TableCell>
              <TableCell>{formatAttendanceDateTime(row.endedAt)}</TableCell>
              <TableCell>
                {formatAttendanceDuration(row.metrics.durationSeconds)}
              </TableCell>
              <TableCell className="capitalize">{row.provider}</TableCell>
              <TableCell>{row.metrics.expectedParticipantCount}</TableCell>
              <TableCell>
                {row.metrics.attendeeCount}/
                {row.metrics.expectedParticipantCount || row.metrics.participantCount}
              </TableCell>
              <TableCell>{row.metrics.fullAttendanceCount}</TableCell>
              <TableCell>{row.metrics.noShowCount}</TableCell>
              <TableCell>
                <Badge
                  variant={getAttendanceStatusTone(row.status)}
                  className="capitalize"
                >
                  {row.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/${orgSlug}/admin/attendance/sessions/${row.ids.id}`}
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Details
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
