'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@iconicedu/ui-web';
import { Loader2, RotateCw } from '@iconicedu/ui-web';
import { Check, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { AdminFilterBar } from '@iconicedu/web/components/admin/admin-filter-bar';

import type { AdminLearningSpaceRow } from '@iconicedu/web/lib/admin/learning-spaces';
import { LearningSpacesTable } from '@iconicedu/web/app/(app)/[orgSlug]/admin/classrooms/learning-spaces-table';
import { LearningSpaceFormDialog } from '@iconicedu/web/app/(app)/[orgSlug]/admin/classrooms/learning-space-form-dialog';
import type { UserProfileVM } from '@iconicedu/shared-types';
import type { LearningSpaceDetail } from '@iconicedu/web/lib/admin/learning-space-detail';

const PAGE_SIZES = [10, 25, 50];

type LearningSpacesDashboardProps = {
  rows: AdminLearningSpaceRow[];
  currentUserTimezone?: string | null;
  subjectOptions?: string[];
};

export function LearningSpacesDashboard({
  rows,
  currentUserTimezone,
  subjectOptions,
}: LearningSpacesDashboardProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | string>('all');
  const [participantFilter, setParticipantFilter] = React.useState<'all' | string>('all');
  const [participantFilterOpen, setParticipantFilterOpen] = React.useState(false);
  const [pageIndex, setPageIndex] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZES[0]);
  const [isPending, startTransition] = React.useTransition();
  const [participantOptions, setParticipantOptions] = React.useState<UserProfileVM[]>([]);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editData, setEditData] = React.useState<LearningSpaceDetail | null>(null);
  const refreshing = isPending;

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
    setPageIndex(1);
  }, [search, statusFilter, participantFilter, pageSize]);

  React.useEffect(() => {
    void loadParticipants();
  }, [loadParticipants]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredRows = React.useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) {
        return false;
      }
      if (
        participantFilter !== 'all' &&
        !row.participantDetails.some(
          (participant) => participant.id === participantFilter,
        )
      ) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      if (row.title.toLowerCase().includes(normalizedSearch)) {
        return true;
      }
      if (row.subject?.toLowerCase().includes(normalizedSearch)) {
        return true;
      }
      if (row.description?.toLowerCase().includes(normalizedSearch)) {
        return true;
      }
      return false;
    });
  }, [rows, normalizedSearch, statusFilter, participantFilter]);

  const participantFilterOptions = React.useMemo(
    () =>
      [...participantOptions]
        .sort((a, b) =>
          (a.profile.displayName ?? '').localeCompare(b.profile.displayName ?? '', 'en', {
            sensitivity: 'base',
          }),
        )
        .map((participant) => ({
          id: participant.ids.id,
          name: participant.profile.displayName ?? 'Unknown',
        })),
    [participantOptions],
  );
  const selectedParticipantFilterLabel = React.useMemo(() => {
    if (participantFilter === 'all') {
      return 'All';
    }
    return (
      participantFilterOptions.find((participant) => participant.id === participantFilter)
        ?.name ?? 'All'
    );
  }, [participantFilter, participantFilterOptions]);

  const sortedRows = React.useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const updatedAtA = new Date(a.updated_at ?? a.created_at).getTime();
      const updatedAtB = new Date(b.updated_at ?? b.created_at).getTime();

      if (updatedAtA !== updatedAtB) {
        return updatedAtB - updatedAtA;
      }

      return a.title.localeCompare(b.title, 'en', { sensitivity: 'base', numeric: true });
    });
  }, [filteredRows]);

  const totalRows = sortedRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const visibleRows = sortedRows.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);

  const handleRefresh = () => {
    startTransition(() => router.refresh());
    void loadParticipants();
  };

  const handleEdit = async (row: LearningSpacesDashboardProps['rows'][number]) => {
    try {
      const response = await fetch('/api/admin/spaces/detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learningSpaceId: row.id }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        message?: string;
        data?: LearningSpaceDetail;
      };
      if (!response.ok || !payload.success || !payload.data) {
        setEditData(null);
        return;
      }
      setEditData(payload.data);
      setEditOpen(true);
    } finally {
      // no-op
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <LearningSpaceFormDialog
        participantOptions={participantOptions}
        defaultScheduleTimezone={currentUserTimezone}
        subjectOptions={subjectOptions}
      />
      <LearningSpaceFormDialog
        mode="edit"
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditData(null);
          }
        }}
        participantOptions={participantOptions}
        defaultScheduleTimezone={currentUserTimezone}
        subjectOptions={subjectOptions}
        initialData={editData}
        onSuccess={() => {
          handleRefresh();
          setEditData(null);
        }}
      />

      {/* Filter bar */}
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

      {/* Table container */}
      <div className="rounded-xl border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
          <h2 className="text-sm font-semibold">Classrooms ({totalRows})</h2>
        </div>
        <div className="relative">
          {isPending && (
            <div className="absolute inset-0 bg-card/70 flex items-center justify-center z-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          <LearningSpacesTable rows={visibleRows} onEdit={handleEdit} />
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
