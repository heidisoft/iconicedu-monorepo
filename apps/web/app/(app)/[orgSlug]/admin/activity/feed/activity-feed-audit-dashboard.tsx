'use client';

import * as React from 'react';
import type {
  AdminActivityFeedAuditVM,
  AdminActivityFeedItemVM,
} from '@iconicedu/shared-types';

import {
  Badge,
  Button,
  ChevronLeft,
  ChevronRight,
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

type ActivityFeedAuditDashboardProps = {
  audit: AdminActivityFeedAuditVM;
};

const PAGE_SIZES = [10, 25, 50];
const ALL_VERBS = 'all';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatChannel(item: AdminActivityFeedItemVM) {
  if (!item.channel) return item.scopeLabel;
  const kind = item.channel.kind ? ` · ${item.channel.kind}` : '';
  return `${item.channel.label}${kind}`;
}

function formatDeliveryChannels(item: AdminActivityFeedItemVM) {
  if (!item.deliveryChannels.length) return 'Inbox only';
  return item.deliveryChannels
    .map((delivery) => `${delivery.channel} ${delivery.status}`)
    .join(', ');
}

function formatPipelineJobs(item: AdminActivityFeedItemVM) {
  if (!item.pipelineJobs.length) return 'No pipeline jobs';
  return item.pipelineJobs.map((job) => `${job.kind} ${job.status}`).join(', ');
}

function formatReminderJobs(item: AdminActivityFeedItemVM) {
  if (!item.reminderJobs.length) return 'No reminder job';
  return item.reminderJobs
    .map((job) => {
      const offset =
        typeof job.reminderOffsetMinutes === 'number'
          ? ` ${job.reminderOffsetMinutes}m`
          : '';
      return `${job.jobType}${offset} ${job.status}`;
    })
    .join(', ');
}

export function filterActivityFeedAuditItems(
  items: AdminActivityFeedItemVM[],
  input: { search: string; verb: string },
) {
  const normalizedSearch = input.search.trim().toLowerCase();

  return items.filter((item) => {
    if (input.verb !== ALL_VERBS && item.verb !== input.verb) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    const fields = [
      item.verb,
      item.summary,
      item.recipient.displayName,
      item.actor?.displayName,
      item.channel?.label,
      item.scopeLabel,
      item.dedupeKey,
      formatDeliveryChannels(item),
      formatPipelineJobs(item),
      formatReminderJobs(item),
    ];

    return fields.some((field) => field?.toLowerCase().includes(normalizedSearch));
  });
}

export function ActivityFeedAuditDashboard({ audit }: ActivityFeedAuditDashboardProps) {
  const [search, setSearch] = React.useState('');
  const [verb, setVerb] = React.useState(ALL_VERBS);
  const [pageIndex, setPageIndex] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZES[1]);

  React.useEffect(() => {
    setPageIndex(1);
  }, [search, verb, pageSize]);

  const filteredItems = React.useMemo(
    () => filterActivityFeedAuditItems(audit.items, { search, verb }),
    [audit.items, search, verb],
  );

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount);
  const visibleItems = filteredItems.slice(
    (safePageIndex - 1) * pageSize,
    safePageIndex * pageSize,
  );

  const from = filteredItems.length === 0 ? 0 : (safePageIndex - 1) * pageSize + 1;
  const to = Math.min(safePageIndex * pageSize, filteredItems.length);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded-xl border bg-card px-5 pt-4 pb-5">
          <p className="text-sm text-muted-foreground">Generated items</p>
          <div className="flex items-end justify-between mt-2 gap-2">
            <p className="text-4xl font-bold tracking-tight leading-none">
              {audit.totalCount}
            </p>
          </div>
        </div>
        <div className="rounded-xl border bg-card px-5 pt-4 pb-5">
          <p className="text-sm text-muted-foreground">Unread items</p>
          <div className="flex items-end justify-between mt-2 gap-2">
            <p className="text-4xl font-bold tracking-tight leading-none">
              {audit.unreadCount}
            </p>
          </div>
        </div>
        <div className="rounded-xl border bg-card px-5 pt-4 pb-5">
          <p className="text-sm text-muted-foreground">Tracked verbs</p>
          <div className="flex items-end justify-between mt-2 gap-2">
            <p className="text-4xl font-bold tracking-tight leading-none">
              {audit.verbSummaries.length}
            </p>
          </div>
        </div>
        <div className="rounded-xl border bg-card px-5 pt-4 pb-5">
          <p className="text-sm text-muted-foreground">Pipeline jobs</p>
          <div className="flex items-end justify-between mt-2 gap-2">
            <p className="text-4xl font-bold tracking-tight leading-none">
              {audit.pipelineJobCount}
            </p>
          </div>
        </div>
        <div className="rounded-xl border bg-card px-5 pt-4 pb-5">
          <p className="text-sm text-muted-foreground">Reminder jobs</p>
          <div className="flex items-end justify-between mt-2 gap-2">
            <p className="text-4xl font-bold tracking-tight leading-none">
              {audit.reminderJobCount}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
          <h2 className="text-sm font-semibold">Created per verb</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Verb</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Unread</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Channels</TableHead>
              <TableHead>Latest</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {audit.verbSummaries.map((summary) => (
              <TableRow key={summary.verb}>
                <TableCell className="font-medium">{summary.verb}</TableCell>
                <TableCell>{summary.count}</TableCell>
                <TableCell>{summary.unreadCount}</TableCell>
                <TableCell>{summary.recipientCount}</TableCell>
                <TableCell>{summary.channelCount}</TableCell>
                <TableCell>{formatDateTime(summary.latestOccurredAt)}</TableCell>
              </TableRow>
            ))}
            {!audit.verbSummaries.length ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No generated activity items found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-xl border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 h-9 w-80 rounded-lg border bg-background px-3 focus-within:ring-2 focus-within:ring-ring shrink-0">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
              placeholder="Search verb, user, channel, job, or delivery"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={verb} onValueChange={setVerb}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="Verb" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VERBS}>All verbs</SelectItem>
              {audit.verbSummaries.map((summary) => (
                <SelectItem key={summary.verb} value={summary.verb}>
                  {summary.verb}
                </SelectItem>
              ))}
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
            Generated {formatDateTime(audit.generatedAt)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Activity</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Delivery</TableHead>
              <TableHead>Reminder</TableHead>
              <TableHead>Pipeline</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Occurred</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="min-w-0 max-w-sm">
                    <p className="truncate text-sm font-semibold">{item.verb}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.summary}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="min-w-0">
                    <p className="truncate text-sm">{item.recipient.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.recipient.kind ?? 'profile'}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {item.actor?.displayName ?? 'System'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.actor?.kind ?? 'system'}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="min-w-0 max-w-xs">
                    <p className="truncate text-sm">{formatChannel(item)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.dedupeKey ?? item.sourceEventId ?? item.id}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="max-w-xs text-sm text-muted-foreground">
                  <span className="block truncate">{formatDeliveryChannels(item)}</span>
                </TableCell>
                <TableCell className="max-w-xs text-sm text-muted-foreground">
                  <span className="block truncate">{formatReminderJobs(item)}</span>
                </TableCell>
                <TableCell className="max-w-xs text-sm text-muted-foreground">
                  <span className="block truncate">{formatPipelineJobs(item)}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={item.isRead ? 'secondary' : 'outline'}>
                    {item.isRead ? 'Read' : 'Unread'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {formatDateTime(item.occurredAt)}
                </TableCell>
              </TableRow>
            ))}
            {!visibleItems.length ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No generated activity items match the current filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between px-6 py-3 border-t">
          <p className="text-xs text-muted-foreground">
            {from}–{to} of {filteredItems.length}
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
