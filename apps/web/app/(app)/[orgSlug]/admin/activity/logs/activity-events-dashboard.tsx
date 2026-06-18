'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Badge,
  Button,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCw,
  Search,
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
} from '@iconicedu/ui-web';

import type { AdminActivityEventRow } from '@iconicedu/web/lib/admin/activity-events';

type ActivityEventsDashboardProps = {
  orgId: string;
  rows: AdminActivityEventRow[];
};

type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'ghost'
  | 'link';

type ProjectionStatus = 'all' | 'pending' | 'processing' | 'projected' | 'failed';

const PAGE_SIZES = [10, 25, 50];
const STATUS_BADGE_VARIANTS: Record<string, BadgeVariant> = {
  pending: 'outline',
  processing: 'default',
  projected: 'secondary',
  failed: 'destructive',
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function toErrorPreview(value: string | null | undefined) {
  if (!value) {
    return '—';
  }
  return value.length > 96 ? `${value.slice(0, 96)}…` : value;
}

export function filterActivityEventRows(
  rows: AdminActivityEventRow[],
  input: { search: string; statusFilter: ProjectionStatus },
) {
  const normalizedSearch = input.search.trim().toLowerCase();

  return rows.filter((row) => {
    if (input.statusFilter !== 'all' && row.projection_status !== input.statusFilter) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    const searchFields = [
      row.event_type,
      row.actorDisplayName,
      row.scopeLabel,
      row.objectLabel,
      row.targetLabel,
      row.dedupe_key,
      row.last_projection_error,
    ];

    return searchFields.some((field) => field?.toLowerCase().includes(normalizedSearch));
  });
}

export function ActivityEventsDashboard({ orgId, rows }: ActivityEventsDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<ProjectionStatus>('all');
  const [pageIndex, setPageIndex] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZES[0]);

  React.useEffect(() => {
    setPageIndex(1);
  }, [search, statusFilter, pageSize]);

  const filteredRows = React.useMemo(() => {
    return filterActivityEventRows(rows, { search, statusFilter });
  }, [rows, search, statusFilter]);

  const totalRows = filteredRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount);
  const visibleRows = filteredRows.slice(
    (safePageIndex - 1) * pageSize,
    safePageIndex * pageSize,
  );

  const from = totalRows === 0 ? 0 : (safePageIndex - 1) * pageSize + 1;
  const to = Math.min(safePageIndex * pageSize, totalRows);

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="rounded-xl border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 h-9 w-72 rounded-lg border bg-background px-3 focus-within:ring-2 focus-within:ring-ring shrink-0">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
              placeholder="Search event, actor, or scope"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as ProjectionStatus)}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="projected">Projected</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => setPageSize(Number(value))}
          >
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue placeholder="Rows" />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} rows
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isPending}
            className="ml-auto gap-2"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCw className="size-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
          <h2 className="text-sm font-semibold">Activity events</h2>
          <span className="text-xs text-muted-foreground">
            {rows.filter((row) => row.projection_status === 'failed').length} failed
          </span>
        </div>
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Occurred</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.length ? (
              visibleRows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-b border-border/60 last:border-b-0"
                >
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{row.event_type}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.targetLabel ?? row.objectLabel ?? row.id}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate text-sm">{row.scopeLabel}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.dedupe_key ?? 'No dedupe key'}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate text-sm">
                        {row.actorDisplayName ?? 'Unknown actor'}
                      </p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {row.source_kind.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={STATUS_BADGE_VARIANTS[row.projection_status] ?? 'ghost'}
                      className="px-3 text-xs"
                    >
                      {row.projection_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{row.projection_attempts}</TableCell>
                  <TableCell className="text-sm">
                    {formatDateTime(row.occurred_at)}
                  </TableCell>
                  <TableCell>
                    <span className="block max-w-xs truncate text-sm text-muted-foreground">
                      {toErrorPreview(row.last_projection_error)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No activity events match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between px-6 py-3 border-t">
          <p className="text-xs text-muted-foreground">
            {from}–{to} of {totalRows}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={safePageIndex <= 1}
              onClick={() => setPageIndex((current) => Math.max(1, current - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs text-muted-foreground">
              Page {safePageIndex} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={safePageIndex >= pageCount}
              onClick={() => setPageIndex((current) => Math.min(pageCount, current + 1))}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
