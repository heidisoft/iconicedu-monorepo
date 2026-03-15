'use client';

import * as React from 'react';
import type { OrgSubjectCatalogSnapshotVM } from '@iconicedu/shared-types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Loader2,
  toast,
} from '@iconicedu/ui-web';

type SubjectCatalogSettingsDashboardProps = {
  orgId: string;
};

function formatUsageLabel(input: {
  learningSpaceCount: number;
  educatorProfileCount: number;
}) {
  const parts: string[] = [];
  if (input.learningSpaceCount) {
    parts.push(
      `${input.learningSpaceCount} classroom${input.learningSpaceCount === 1 ? '' : 's'}`,
    );
  }
  if (input.educatorProfileCount) {
    parts.push(
      `${input.educatorProfileCount} educator${input.educatorProfileCount === 1 ? '' : 's'}`,
    );
  }
  return parts.length ? parts.join(' • ') : 'Not used yet';
}

export function SubjectCatalogSettingsDashboard({
  orgId,
}: SubjectCatalogSettingsDashboardProps) {
  const [snapshot, setSnapshot] = React.useState<OrgSubjectCatalogSnapshotVM>({
    items: [],
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [newSubject, setNewSubject] = React.useState('');

  const loadSnapshot = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/settings/subjects?orgId=${encodeURIComponent(orgId)}`,
      );
      const payload = (await response.json()) as {
        success?: boolean;
        message?: string;
        data?: OrgSubjectCatalogSnapshotVM;
      };
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message ?? 'Failed to load subject catalog.');
      }
      setSnapshot(payload.data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to load subject catalog.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  React.useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const filteredItems = React.useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) {
      return snapshot.items;
    }
    return snapshot.items.filter((item) =>
      item.subject.toLowerCase().includes(normalized),
    );
  }, [search, snapshot.items]);

  const handleAddSubject = React.useCallback(async () => {
    if (!newSubject.trim()) {
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/settings/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, subject: newSubject }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? 'Failed to add subject.');
      }
      setNewSubject('');
      await loadSnapshot();
      toast.success('Subject saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add subject.');
    } finally {
      setIsSaving(false);
    }
  }, [loadSnapshot, newSubject, orgId]);

  const toggleSubject = React.useCallback(
    async (subjectId: string, isActive: boolean) => {
      setIsSaving(true);
      try {
        const response = await fetch('/api/admin/settings/subjects', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId, subjectId, isActive }),
        });
        const payload = (await response.json()) as {
          success?: boolean;
          message?: string;
        };
        if (!response.ok || !payload.success) {
          throw new Error(payload.message ?? 'Failed to update subject.');
        }
        await loadSnapshot();
        toast.success(
          isActive ? 'Subject restored' : 'Subject hidden from new selections',
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update subject.');
      } finally {
        setIsSaving(false);
      }
    },
    [loadSnapshot, orgId],
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading subject catalog...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="gap-2">
          <CardTitle>Subject catalog</CardTitle>
          <CardDescription>
            Active subjects appear in classroom, educator, and class-request subject
            pickers.
          </CardDescription>
          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search subjects"
              className="md:max-w-sm"
            />
            <div className="flex gap-2 md:ml-auto md:max-w-md md:flex-1">
              <Input
                value={newSubject}
                onChange={(event) => setNewSubject(event.target.value)}
                placeholder="Add subject"
                disabled={isSaving}
              />
              <Button
                type="button"
                onClick={() => void handleAddSubject()}
                disabled={isSaving || !newSubject.trim()}
              >
                Add
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-md border border-border px-4 py-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{item.subject}</p>
                  <Badge variant={item.isActive ? 'secondary' : 'outline'}>
                    {item.isActive ? 'Active' : 'Hidden'}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatUsageLabel(item)}
                </p>
              </div>
              <Button
                type="button"
                variant={item.isActive ? 'outline' : 'secondary'}
                size="sm"
                disabled={isSaving}
                onClick={() => void toggleSubject(item.id, !item.isActive)}
              >
                {item.isActive ? 'Hide' : 'Restore'}
              </Button>
            </div>
          ))}
          {!filteredItems.length ? (
            <p className="text-sm text-muted-foreground">No subjects match the filter.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
