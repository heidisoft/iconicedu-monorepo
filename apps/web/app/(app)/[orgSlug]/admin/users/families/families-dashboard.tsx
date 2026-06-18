'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@iconicedu/ui-web';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { AdminFilterBar } from '@iconicedu/web/components/admin/admin-filter-bar';

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
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <AdminFilterBar
        search={search}
        onSearchChange={setSearch}
        filterGroups={[
          {
            label: 'Invites',
            value: filter,
            options: [
              { value: 'all', label: 'All' },
              { value: 'with-invites', label: 'Pending' },
              { value: 'without-invites', label: 'None' },
            ],
            onChange: (v) => setFilter(v as 'all' | 'with-invites' | 'without-invites'),
          },
        ]}
      />

      {/* Table container */}
      <div className="rounded-xl border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
          <h2 className="text-sm font-semibold">Families ({totalRows})</h2>
        </div>
        <div className="relative">
          {isPending && (
            <div className="absolute inset-0 bg-card/70 flex items-center justify-center z-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          <FamiliesTable rows={visibleRows} />
        </div>
        <div className="flex items-center justify-between px-6 py-3 border-t">
          <p className="text-xs text-muted-foreground">
            {totalRows === 0 ? '0' : (pageIndex - 1) * pageSize + 1}–
            {Math.min(pageIndex * pageSize, totalRows)} of {totalRows}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={pageIndex <= 1}
              onClick={() => setPageIndex((prev) => Math.max(1, prev - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs text-muted-foreground">
              Page {pageIndex} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={pageIndex >= pageCount}
              onClick={() => setPageIndex((prev) => Math.min(pageCount, prev + 1))}
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
