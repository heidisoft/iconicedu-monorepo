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
        searchPlaceholder="Search label, detail, status, or error"
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
              <TableHead>Job</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Run at</TableHead>
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
                    {record.detail ? (
                      <p className="truncate text-xs text-muted-foreground">
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
                  <Badge variant={jobActivityStatusVariant(record.status)}>
                    {record.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatJobActivityAttempts(record)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatJobActivityDateTime(record.runAt)}
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
                  colSpan={6}
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
