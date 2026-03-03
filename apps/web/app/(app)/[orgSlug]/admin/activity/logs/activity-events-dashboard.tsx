'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Loader2,
  MoreHorizontal,
  RotateCw,
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

export function ActivityEventsDashboard({
  orgId,
  rows,
}: ActivityEventsDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<ProjectionStatus>('all');
  const [pageIndex, setPageIndex] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZES[0]);
  const [retryingId, setRetryingId] = React.useState<string | null>(null);

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

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const handleRetry = async (eventId: string) => {
    setRetryingId(eventId);

    try {
      const response = await fetch('/api/admin/activity/events/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, orgId }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        message?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? 'Unable to retry activity event.');
      }

      toast.success('Retry queued.');
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to retry activity event.',
      );
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search event, actor, or scope"
            className="w-full sm:max-w-sm"
          />
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
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isPending}
          className="gap-2"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
          Refresh
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm text-muted-foreground">
          <span>
            Showing {visibleRows.length} of {totalRows} activity events
          </span>
          <span>{rows.filter((row) => row.projection_status === 'failed').length} failed</span>
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.length ? (
              visibleRows.map((row) => {
                const retryable = row.projection_status === 'failed';
                const isRetrying = retryingId === row.id;

                return (
                  <TableRow key={row.id} className="border-b border-border/60 last:border-b-0">
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
                        <p className="truncate text-sm">{row.actorDisplayName ?? 'Unknown actor'}</p>
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
                    <TableCell className="text-sm">{formatDateTime(row.occurred_at)}</TableCell>
                    <TableCell>
                      <span className="block max-w-xs truncate text-sm text-muted-foreground">
                        {toErrorPreview(row.last_projection_error)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="px-2">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              if (retryable) {
                                void handleRetry(row.id);
                              }
                            }}
                            disabled={!retryable || isRetrying}
                          >
                            {isRetrying ? (
                              <Loader2 className="mr-2 size-3 animate-spin" />
                            ) : (
                              <RotateCw className="mr-2 size-3" />
                            )}
                            Retry projection
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  No activity events match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Page {safePageIndex} of {pageCount}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPageIndex((current) => Math.max(1, current - 1))}
            disabled={safePageIndex <= 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => setPageIndex((current) => Math.min(pageCount, current + 1))}
            disabled={safePageIndex >= pageCount}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
