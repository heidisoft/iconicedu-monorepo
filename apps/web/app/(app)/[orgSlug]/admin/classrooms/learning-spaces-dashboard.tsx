'use client';

import * as React from 'react';
import Link from 'next/link';

import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Loader2,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@iconicedu/ui-web';
import { Check, ChevronsUpDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { AdminFilterBar } from '@iconicedu/web/components/admin/admin-filter-bar';

import type { AdminLearningSpaceRow } from '@iconicedu/web/lib/admin/learning-spaces';
import { LearningSpacesTable } from '@iconicedu/web/app/(app)/[orgSlug]/admin/classrooms/learning-spaces-table';
import type { UserProfileVM } from '@iconicedu/shared-types';

const PAGE_SIZE = 10;

type LearningSpacesDashboardProps = {
  orgSlug: string;
};

export function LearningSpacesDashboard({ orgSlug }: LearningSpacesDashboardProps) {
  // Lazy-load state
  const [rows, setRows] = React.useState<AdminLearningSpaceRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [participantFilter, setParticipantFilter] = React.useState('all');
  const [participantFilterOpen, setParticipantFilterOpen] = React.useState(false);
  const [pageIndex, setPageIndex] = React.useState(1);
  const [participantOptions, setParticipantOptions] = React.useState<UserProfileVM[]>([]);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    setPageIndex(1);
  }, [debouncedSearch, statusFilter, participantFilter]);

  const fetchPage = React.useCallback(
    async (page: number) => {
      setLoading(true);
      setFetchError(null);
      try {
        const params = new URLSearchParams({
          orgSlug,
          page: String(page),
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
          ...(participantFilter !== 'all' ? { participantId: participantFilter } : {}),
        });
        const res = await fetch(`/api/admin/spaces/list?${params.toString()}`);
        const json = (await res.json()) as {
          success?: boolean;
          message?: string;
          rows?: AdminLearningSpaceRow[];
          total?: number;
          pageCount?: number;
        };
        if (!res.ok || !json.success) throw new Error(json.message ?? 'Failed to load');
        setRows(json.rows ?? []);
        setTotal(json.total ?? 0);
        setPageCount(json.pageCount ?? 1);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Failed to load classrooms');
      } finally {
        setLoading(false);
      }
    },
    [orgSlug, debouncedSearch, statusFilter, participantFilter],
  );

  React.useEffect(() => {
    void fetchPage(pageIndex);
  }, [fetchPage, pageIndex]);

  const loadParticipants = React.useCallback(async () => {
    try {
      const response = await fetch('/api/admin/spaces/participants', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        setParticipantOptions([]);
        return;
      }
      const payload = (await response.json()) as { data?: UserProfileVM[] };
      setParticipantOptions(payload.data ?? []);
    } catch {
      setParticipantOptions([]);
    }
  }, []);

  React.useEffect(() => {
    void loadParticipants();
  }, [loadParticipants]);

  const participantFilterOptions = React.useMemo(
    () =>
      [...participantOptions]
        .sort((a, b) =>
          (a.profile.displayName ?? '').localeCompare(b.profile.displayName ?? '', 'en', {
            sensitivity: 'base',
          }),
        )
        .map((p) => ({ id: p.ids.id, name: p.profile.displayName ?? 'Unknown' })),
    [participantOptions],
  );

  const selectedParticipantFilterLabel =
    participantFilter === 'all'
      ? 'All'
      : (participantFilterOptions.find((p) => p.id === participantFilter)?.name ?? 'All');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Classrooms</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage learning spaces, subjects, participants, and schedules.
          </p>
        </div>
        <Button asChild size="sm" className="flex items-center gap-2">
          <Link href={`/${orgSlug}/admin/classrooms/new`}>
            <Plus className="size-4" />
            Add new
          </Link>
        </Button>
      </div>

      <AdminFilterBar
        search={search}
        onSearchChange={setSearch}
        filterGroups={[
          {
            label: 'Status',
            value: statusFilter,
            options: [
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'archived', label: 'Archived' },
              { value: 'paused', label: 'Paused' },
            ],
            onChange: setStatusFilter,
          },
        ]}
        extraFilters={
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Participant
            </span>
            <Popover open={participantFilterOpen} onOpenChange={setParticipantFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={participantFilterOpen}
                  aria-label="Filter by participant"
                  className="h-8 w-40 justify-between"
                >
                  <span className="truncate">{selectedParticipantFilterLabel}</span>
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0" align="start">
                <Command>
                  <CommandInput
                    aria-label="Search participants"
                    placeholder="Search participants..."
                  />
                  <CommandList>
                    <CommandEmpty>No participants found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          setParticipantFilter('all');
                          setParticipantFilterOpen(false);
                        }}
                      >
                        All
                        <Check
                          className={
                            participantFilter === 'all'
                              ? 'ml-auto size-4 opacity-100'
                              : 'ml-auto size-4 opacity-0'
                          }
                        />
                      </CommandItem>
                      {participantFilterOptions.map((participant) => (
                        <CommandItem
                          key={participant.id}
                          value={`${participant.name} ${participant.id}`}
                          onSelect={() => {
                            setParticipantFilter(participant.id);
                            setParticipantFilterOpen(false);
                          }}
                        >
                          {participant.name}
                          <Check
                            className={
                              participantFilter === participant.id
                                ? 'ml-auto size-4 opacity-100'
                                : 'ml-auto size-4 opacity-0'
                            }
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        }
      />

      <div className="rounded-xl border overflow-hidden">
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 rounded-xl bg-card/90 flex items-center justify-center z-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
            <h2 className="text-sm font-semibold">Classrooms ({total})</h2>
          </div>
          {fetchError ? (
            <p className="px-6 py-10 text-center text-sm text-destructive">
              {fetchError}
            </p>
          ) : !loading && rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No classrooms found.
            </p>
          ) : (
            <LearningSpacesTable rows={rows} orgSlug={orgSlug} />
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
