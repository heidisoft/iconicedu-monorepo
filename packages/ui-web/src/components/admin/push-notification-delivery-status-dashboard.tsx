'use client';

import * as React from 'react';
import type {
  AdminActivityFeedAuditVM,
  AdminActivityFeedDeliveryChannelVM,
  AdminActivityFeedItemVM,
} from '@iconicedu/shared-types';

import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

import { Badge } from '@iconicedu/ui-web/ui/badge';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@iconicedu/ui-web/ui/table';

type PushNotificationDeliveryStatusDashboardProps = {
  audit: AdminActivityFeedAuditVM;
};

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';
export type PushNotificationDeliveryStatusFilter =
  | 'all'
  | 'succeeded'
  | 'failed'
  | 'pending'
  | 'other';

export type PushNotificationDeliveryRow = {
  id: string;
  activityId: string;
  verb: string;
  summary: string;
  recipientName: string;
  recipientKind: string;
  actorName: string;
  channelLabel: string;
  scopeLabel: string;
  status: string;
  createdAt: string;
  occurredAt: string;
  lastError?: string | null;
};

const PAGE_SIZES = [10, 25, 50];
const ALL_STATUSES: PushNotificationDeliveryStatusFilter = 'all';

const STATUS_BADGE_VARIANTS: Record<string, BadgeVariant> = {
  failed: 'destructive',
  pending: 'outline',
  queued: 'outline',
  skipped: 'secondary',
  succeeded: 'secondary',
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function isKnownStatus(status: string) {
  return ['succeeded', 'failed', 'pending'].includes(status);
}

function statusMatchesFilter(
  status: string,
  filter: PushNotificationDeliveryStatusFilter,
) {
  if (filter === ALL_STATUSES) return true;
  if (filter === 'other') return !isKnownStatus(status);
  return status === filter;
}

function getDeliveryId(
  item: AdminActivityFeedItemVM,
  delivery: AdminActivityFeedDeliveryChannelVM,
  index: number,
) {
  return `${item.id}:${delivery.channel}:${delivery.status}:${delivery.createdAt}:${index}`;
}

export function buildPushNotificationDeliveryRows(
  audit: AdminActivityFeedAuditVM,
): PushNotificationDeliveryRow[] {
  return audit.items
    .flatMap((item) =>
      item.deliveryChannels
        .filter((delivery) => delivery.channel === 'push')
        .map((delivery, index) => ({
          id: getDeliveryId(item, delivery, index),
          activityId: item.id,
          verb: item.verb,
          summary: item.summary,
          recipientName: item.recipient.displayName,
          recipientKind: item.recipient.kind ?? 'profile',
          actorName: item.actor?.displayName ?? 'System',
          channelLabel: item.channel?.label ?? item.scopeLabel,
          scopeLabel: item.scopeLabel,
          status: delivery.status,
          createdAt: delivery.createdAt,
          occurredAt: item.occurredAt,
          lastError: delivery.lastError,
        })),
    )
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
}

export function filterPushNotificationDeliveryRows(
  rows: PushNotificationDeliveryRow[],
  input: { search: string; status: PushNotificationDeliveryStatusFilter },
) {
  const normalizedSearch = input.search.trim().toLowerCase();

  return rows.filter((row) => {
    if (!statusMatchesFilter(row.status, input.status)) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    const searchFields = [
      row.verb,
      row.summary,
      row.recipientName,
      row.recipientKind,
      row.actorName,
      row.channelLabel,
      row.scopeLabel,
      row.status,
      row.lastError,
    ];

    return searchFields.some((field) => field?.toLowerCase().includes(normalizedSearch));
  });
}

function countByStatus(rows: PushNotificationDeliveryRow[], status: string) {
  return rows.filter((row) => row.status === status).length;
}

function getLatestDeliveryAt(rows: PushNotificationDeliveryRow[]) {
  return rows[0]?.createdAt ?? null;
}

function getSuccessRate(rows: PushNotificationDeliveryRow[]) {
  if (!rows.length) return 0;
  return Math.round((countByStatus(rows, 'succeeded') / rows.length) * 100);
}

function getStatusBadgeVariant(status: string): BadgeVariant {
  return STATUS_BADGE_VARIANTS[status] ?? 'default';
}

function formatError(value: string | null | undefined) {
  if (!value) return 'No error';
  return value.length > 100 ? `${value.slice(0, 100)}...` : value;
}

export function PushNotificationDeliveryStatusDashboard({
  audit,
}: PushNotificationDeliveryStatusDashboardProps) {
  const [search, setSearch] = React.useState('');
  const [status, setStatus] =
    React.useState<PushNotificationDeliveryStatusFilter>(ALL_STATUSES);
  const [pageIndex, setPageIndex] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZES[1]);

  const rows = React.useMemo(() => buildPushNotificationDeliveryRows(audit), [audit]);

  React.useEffect(() => {
    setPageIndex(1);
  }, [search, status, pageSize]);

  const filteredRows = React.useMemo(
    () => filterPushNotificationDeliveryRows(rows, { search, status }),
    [rows, search, status],
  );

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount);
  const visibleRows = filteredRows.slice(
    (safePageIndex - 1) * pageSize,
    safePageIndex * pageSize,
  );
  const from = filteredRows.length === 0 ? 0 : (safePageIndex - 1) * pageSize + 1;
  const to = Math.min(safePageIndex * pageSize, filteredRows.length);

  const latestDeliveryAt = getLatestDeliveryAt(rows);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border bg-card px-5 pb-5 pt-4">
          <p className="text-sm text-muted-foreground">Push attempts</p>
          <p className="mt-2 text-4xl font-bold leading-none tracking-tight">
            {rows.length}
          </p>
        </div>
        <div className="rounded-lg border bg-card px-5 pb-5 pt-4">
          <p className="text-sm text-muted-foreground">Succeeded</p>
          <p className="mt-2 text-4xl font-bold leading-none tracking-tight">
            {countByStatus(rows, 'succeeded')}
          </p>
        </div>
        <div className="rounded-lg border bg-card px-5 pb-5 pt-4">
          <p className="text-sm text-muted-foreground">Failed</p>
          <p className="mt-2 text-4xl font-bold leading-none tracking-tight">
            {countByStatus(rows, 'failed')}
          </p>
        </div>
        <div className="rounded-lg border bg-card px-5 pb-5 pt-4">
          <p className="text-sm text-muted-foreground">Success rate</p>
          <p className="mt-2 text-4xl font-bold leading-none tracking-tight">
            {getSuccessRate(rows)}%
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-9 w-full shrink-0 items-center gap-2 rounded-lg border bg-background px-3 focus-within:ring-2 focus-within:ring-ring sm:w-96">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
              placeholder="Search recipient, activity, channel, or error"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) =>
              setStatus(value as PushNotificationDeliveryStatusFilter)
            }
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="succeeded">Succeeded</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="other">Other</SelectItem>
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
          <p className="ml-auto text-sm text-muted-foreground">
            Latest {latestDeliveryAt ? formatDateTime(latestDeliveryAt) : 'none'}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between border-b bg-muted/30 px-6 py-4">
          <h2 className="text-sm font-semibold">Delivery attempts</h2>
          <span className="text-xs text-muted-foreground">
            Generated {formatDateTime(audit.generatedAt)}
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Activity</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Delivered</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="min-w-0 max-w-xs">
                    <p className="truncate text-sm font-semibold">{row.verb}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.summary}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="min-w-0">
                    <p className="truncate text-sm">{row.recipientName}</p>
                    <p className="text-xs text-muted-foreground">{row.recipientKind}</p>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{row.actorName}</TableCell>
                <TableCell>
                  <div className="min-w-0 max-w-xs">
                    <p className="truncate text-sm">{row.channelLabel}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.scopeLabel}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(row.status)}>{row.status}</Badge>
                </TableCell>
                <TableCell className="text-sm">{formatDateTime(row.createdAt)}</TableCell>
                <TableCell>
                  <span className="block max-w-xs truncate text-sm text-muted-foreground">
                    {formatError(row.lastError)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
            {!visibleRows.length ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No push notification delivery attempts match the current filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t px-6 py-3">
          <p className="text-xs text-muted-foreground">
            {from}-{to} of {filteredRows.length}
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
