'use client';

import * as React from 'react';
import type { AdminJobActivityRecordVM } from '@iconicedu/shared-types';

import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@iconicedu/ui-web';
import { AdminFilterBar } from '@iconicedu/web/components/admin/admin-filter-bar';

import {
  filterJobActivityRecords,
  formatJobActivityAttempts,
  formatJobActivityDateTime,
  jobActivityStatusVariant,
} from '@iconicedu/web/app/(app)/[orgSlug]/admin/activity/job-activity-format';

type JobActivityTableProps = {
  records: AdminJobActivityRecordVM[];
};

const ALL_STATUSES = 'all';

export function JobActivityTable({ records }: JobActivityTableProps) {
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState(ALL_STATUSES);

  const statusOptions = React.useMemo(() => {
    const unique = Array.from(new Set(records.map((record) => record.status))).sort();
    return [
      { value: ALL_STATUSES, label: 'All statuses' },
      ...unique.map((value) => ({ value, label: value })),
    ];
  }, [records]);

  const visibleRecords = React.useMemo(
    () => filterJobActivityRecords(records, { search, status }),
    [records, search, status],
  );

  return (
    <div className="space-y-3">
      <AdminFilterBar
        layout="toolbar"
        filterTitle="Filter job activity"
        filterDescription="Search recent records or narrow to a single status."
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search class, message, recipient, status, or error"
        filterGroups={[
          {
            label: 'Status',
            value: status,
            onChange: setStatus,
            options: statusOptions,
          },
        ]}
      />

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Activity</TableHead>
              <TableHead>For</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Session time</TableHead>
              <TableHead>Processed</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRecords.map((record) => (
              <TableRow key={record.id}>
                <TableCell>
                  <div className="min-w-0 max-w-md">
                    <p className="truncate text-sm font-medium">{record.label}</p>
                    {record.message ? (
                      <p className="truncate text-xs text-muted-foreground">
                        “{record.message}”
                      </p>
                    ) : null}
                    {record.detail ? (
                      <p className="truncate text-[11px] text-muted-foreground/70">
                        {record.detail}
                      </p>
                    ) : null}
                    {record.lastError ? (
                      <p className="mt-0.5 truncate text-xs text-destructive">
                        {record.lastError}
                      </p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex max-w-[16rem] flex-wrap gap-1">
                    {record.participants.length ? (
                      record.participants.map((participant) => (
                        <Badge
                          key={participant}
                          variant="outline"
                          className="font-normal"
                        >
                          {participant}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <Badge variant={jobActivityStatusVariant(record.status)}>
                      {record.status}
                    </Badge>
                    {record.priority ? (
                      <Badge
                        variant={record.priority === 'high' ? 'destructive' : 'secondary'}
                        className="font-normal"
                      >
                        {record.priority}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatJobActivityAttempts(record)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatJobActivityDateTime(record.occurrenceAt)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatJobActivityDateTime(record.dispatchedAt)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatJobActivityDateTime(record.createdAt)}
                </TableCell>
              </TableRow>
            ))}
            {!visibleRecords.length ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No job records match the current filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <div className="border-t px-6 py-3 text-xs text-muted-foreground">
          Showing {visibleRecords.length} of {records.length} sampled records
        </div>
      </div>
    </div>
  );
}
