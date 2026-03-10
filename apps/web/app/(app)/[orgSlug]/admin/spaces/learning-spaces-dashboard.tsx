'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web';
import { Loader2, RotateCw } from '@iconicedu/ui-web';

import type { AdminLearningSpaceRow } from '@iconicedu/web/lib/admin/learning-spaces';
import { LearningSpacesTable } from '@iconicedu/web/app/(app)/[orgSlug]/admin/spaces/learning-spaces-table';
import { LearningSpaceFormDialog } from '@iconicedu/web/app/(app)/[orgSlug]/admin/spaces/learning-space-form-dialog';
import type { UserProfileVM } from '@iconicedu/shared-types';
import type { LearningSpaceDetail } from '@iconicedu/web/lib/admin/learning-space-detail';

const PAGE_SIZES = [10, 25, 50];

type LearningSpacesDashboardProps = {
  rows: AdminLearningSpaceRow[];
};

export function LearningSpacesDashboard({ rows }: LearningSpacesDashboardProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | string>('all');
  const [participantFilter, setParticipantFilter] = React.useState<'all' | string>('all');
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

  const sortedRows = React.useMemo(() => {
    const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
    return [...filteredRows].sort((a, b) => collator.compare(a.title, b.title));
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
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <LearningSpaceFormDialog participantOptions={participantOptions} />
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
          initialData={editData}
          onSuccess={() => {
            handleRefresh();
            setEditData(null);
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search title or subject"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-64"
          />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Status:</span>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as 'all' | string)}
            >
              <SelectTrigger size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Participant:</span>
            <Select
              value={participantFilter}
              onValueChange={(value) => setParticipantFilter(value as 'all' | string)}
            >
              <SelectTrigger size="sm" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {participantFilterOptions.map((participant) => (
                  <SelectItem key={participant.id} value={participant.id}>
                    {participant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh classrooms"
          >
            {refreshing ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (
              <RotateCw className="size-4 transition-transform" />
            )}
          </Button>
        </div>
      </div>
      <div className="relative">
        {isPending && (
          <div className="absolute inset-0 rounded-2xl border border-border bg-card/70 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <LearningSpacesTable rows={visibleRows} onEdit={handleEdit} />
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
