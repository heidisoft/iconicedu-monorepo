'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web';
import { Loader2, RotateCw } from '@iconicedu/ui-web';

import type { AdminFamilyRow } from '@iconicedu/web/lib/admin/families';
import { FamiliesTable } from '@iconicedu/web/app/(app)/[orgSlug]/admin/users/families/families-table';

const PAGE_SIZES = [5, 10, 20];

type FamiliesDashboardProps = {
  rows: AdminFamilyRow[];
};

export function FamiliesDashboard({ rows }: FamiliesDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState<'all' | 'with-invites' | 'without-invites'>(
    'all',
  );
  const [pageIndex, setPageIndex] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZES[0]);
  const refreshing = isPending;

  React.useEffect(() => {
    setPageIndex(1);
  }, [search, filter, pageSize]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredRows = React.useMemo(() => {
    return rows.filter((row) => {
      const haystack = [
        row.displayName,
        ...row.guardians.map((guardian) => guardian.label),
        ...row.children.map((child) => child.label),
      ]
        .join(' ')
        .toLowerCase();

      if (normalizedSearch && !haystack.includes(normalizedSearch)) {
        return false;
      }

      if (filter === 'with-invites' && row.pendingInvites.length === 0) {
        return false;
      }

      if (filter === 'without-invites' && row.pendingInvites.length > 0) {
        return false;
      }

      return true;
    });
  }, [rows, normalizedSearch, filter]);

  const totalRows = filteredRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const visibleRows = filteredRows.slice(
    (pageIndex - 1) * pageSize,
    pageIndex * pageSize,
  );

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center justify-end gap-3">
          <Input
            placeholder="Search family, guardian, or child"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-64"
          />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Invite status:</span>
            <Select
              value={filter}
              onValueChange={(value) => setFilter(value as typeof filter)}
            >
              <SelectTrigger size="sm" className="min-w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All families</SelectItem>
                <SelectItem value="with-invites">With pending invites</SelectItem>
                <SelectItem value="without-invites">Without pending invites</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="px-2"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Refresh families"
        >
          {refreshing ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <RotateCw className="size-4 transition-transform" />
          )}
        </Button>
      </div>
      <div className="relative">
        {isPending && (
          <div className="absolute inset-0 rounded-2xl border border-border bg-card/70 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <FamiliesTable rows={visibleRows} />
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Page size</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => setPageSize(Number(value))}
          >
            <SelectTrigger size="sm" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={pageIndex <= 1}
            onClick={() => setPageIndex((prev) => Math.max(1, prev - 1))}
          >
            Previous
          </Button>
          <span>
            Page {pageIndex} of {pageCount}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={pageIndex >= pageCount}
            onClick={() => setPageIndex((prev) => Math.min(pageCount, prev + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
