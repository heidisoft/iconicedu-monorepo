'use client';

import * as React from 'react';
import { Button, Loader2 } from '@iconicedu/ui-web';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AdminFilterBar } from '@iconicedu/web/components/admin/admin-filter-bar';

import type { AdminFamilyRow } from '@iconicedu/web/lib/admin/families';
import { FamiliesTable } from '@iconicedu/web/app/(app)/[orgSlug]/admin/users/families/families-table';

const PAGE_SIZE = 10;

type FamiliesDashboardProps = {
  orgSlug: string;
};

export function FamiliesDashboard({ orgSlug }: FamiliesDashboardProps) {
  const [rows, setRows] = React.useState<AdminFamilyRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [invitesFilter, setInvitesFilter] = React.useState('all');
  const [pageIndex, setPageIndex] = React.useState(1);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    setPageIndex(1);
  }, [debouncedSearch, invitesFilter]);

  const fetchPage = React.useCallback(
    async (page: number) => {
      setLoading(true);
      setFetchError(null);
      try {
        const params = new URLSearchParams({
          orgSlug,
          page: String(page),
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(invitesFilter !== 'all' ? { invites: invitesFilter } : {}),
        });
        const res = await fetch(`/api/admin/families/list?${params.toString()}`);
        const json = (await res.json()) as {
          success?: boolean;
          message?: string;
          rows?: AdminFamilyRow[];
          total?: number;
          pageCount?: number;
        };
        if (!res.ok || !json.success) throw new Error(json.message ?? 'Failed to load');
        setRows(json.rows ?? []);
        setTotal(json.total ?? 0);
        setPageCount(json.pageCount ?? 1);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Failed to load families');
      } finally {
        setLoading(false);
      }
    },
    [orgSlug, debouncedSearch, invitesFilter],
  );

  React.useEffect(() => {
    void fetchPage(pageIndex);
  }, [fetchPage, pageIndex]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Families</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and manage family groups, guardians, and their children.
          </p>
        </div>
      </div>

      <AdminFilterBar
        search={search}
        onSearchChange={setSearch}
        filterGroups={[
          {
            label: 'Invites',
            value: invitesFilter,
            options: [
              { value: 'all', label: 'All' },
              { value: 'with-invites', label: 'Pending' },
              { value: 'without-invites', label: 'None' },
            ],
            onChange: setInvitesFilter,
          },
        ]}
      />

      <div className="rounded-xl border overflow-hidden">
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 rounded-xl bg-card/90 flex items-center justify-center z-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
            <h2 className="text-sm font-semibold">Families ({total})</h2>
          </div>
          {fetchError ? (
            <p className="px-6 py-10 text-center text-sm text-destructive">
              {fetchError}
            </p>
          ) : !loading && rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No families found.
            </p>
          ) : (
            <FamiliesTable rows={rows} />
          )}
        </div>
        {total > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t">
            <p className="text-xs text-muted-foreground">
              {(pageIndex - 1) * PAGE_SIZE + 1}–{Math.min(pageIndex * PAGE_SIZE, total)}{' '}
              of {total}
            </p>
            {pageCount > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={pageIndex <= 1}
                  onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
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
                  onClick={() => setPageIndex((p) => Math.min(pageCount, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
