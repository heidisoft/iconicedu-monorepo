'use client';

import * as React from 'react';
import type { OrgSubjectCatalogSnapshotVM } from '@iconicedu/shared-types';
import { Badge, Button, Input, Loader2, Search, toast } from '@iconicedu/ui-web';
import { normalizeSubjectKey } from '@iconicedu/web/lib/subjects/utils';

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
  const [editingSubjectId, setEditingSubjectId] = React.useState<string | null>(null);
  const [editingSubjectValue, setEditingSubjectValue] = React.useState('');
  const [editingSubjectKeyValue, setEditingSubjectKeyValue] = React.useState('');
  const [isEditingKeyDirty, setIsEditingKeyDirty] = React.useState(false);

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
    return snapshot.items.filter(
      (item) =>
        item.subject.toLowerCase().includes(normalized) ||
        item.subjectKey.toLowerCase().includes(normalized),
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

  const handleRenameSubject = React.useCallback(
    async (subjectId: string) => {
      if (!editingSubjectValue.trim()) {
        return;
      }
      setIsSaving(true);
      try {
        const response = await fetch('/api/admin/settings/subjects', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId,
            subjectId,
            subject: editingSubjectValue,
            subjectKey: editingSubjectKeyValue,
          }),
        });
        const payload = (await response.json()) as {
          success?: boolean;
          message?: string;
        };
        if (!response.ok || !payload.success) {
          throw new Error(payload.message ?? 'Failed to rename subject.');
        }
        setEditingSubjectId(null);
        setEditingSubjectValue('');
        setEditingSubjectKeyValue('');
        setIsEditingKeyDirty(false);
        await loadSnapshot();
        toast.success('Subject updated');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update subject.');
      } finally {
        setIsSaving(false);
      }
    },
    [editingSubjectKeyValue, editingSubjectValue, loadSnapshot, orgId],
  );

  if (isLoading) {
    return (
      <div className="rounded-xl border overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading subject catalog...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
          <h2 className="text-sm font-semibold">Subject catalog</h2>
          <p className="text-xs text-muted-foreground">
            Active subjects appear in classroom, educator, and class-request subject
            pickers.
          </p>
        </div>
        <div className="px-6 py-4 border-b">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="flex items-center gap-2 h-9 w-full md:max-w-sm rounded-lg border bg-background px-3 focus-within:ring-2 focus-within:ring-ring shrink-0">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
                placeholder="Search subjects"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
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
        </div>
        <div className="divide-y divide-border">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 px-6 py-4 hover:bg-muted/30 transition-colors md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {editingSubjectId === item.id ? (
                    <div className="grid gap-2 md:grid-cols-[minmax(0,18rem)_minmax(0,14rem)]">
                      <Input
                        value={editingSubjectValue}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setEditingSubjectValue(nextValue);
                          if (!isEditingKeyDirty) {
                            setEditingSubjectKeyValue(normalizeSubjectKey(nextValue));
                          }
                        }}
                        className="h-8 w-full"
                        disabled={isSaving}
                        placeholder="Subject name"
                      />
                      <Input
                        value={editingSubjectKeyValue}
                        onChange={(event) => {
                          setEditingSubjectKeyValue(event.target.value);
                          setIsEditingKeyDirty(true);
                        }}
                        className="h-8 w-full font-mono"
                        disabled={isSaving}
                        placeholder="machine-name"
                      />
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium">{item.subject}</p>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {item.subjectKey}
                      </code>
                    </>
                  )}
                  <Badge variant={item.isActive ? 'secondary' : 'outline'}>
                    {item.isActive ? 'Active' : 'Hidden'}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatUsageLabel(item)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {editingSubjectId === item.id ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        isSaving ||
                        !editingSubjectValue.trim() ||
                        !normalizeSubjectKey(editingSubjectKeyValue)
                      }
                      onClick={() => void handleRenameSubject(item.id)}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isSaving}
                      onClick={() => {
                        setEditingSubjectId(null);
                        setEditingSubjectValue('');
                        setEditingSubjectKeyValue('');
                        setIsEditingKeyDirty(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSaving}
                      onClick={() => {
                        setEditingSubjectId(item.id);
                        setEditingSubjectValue(item.subject);
                        setEditingSubjectKeyValue(item.subjectKey);
                        setIsEditingKeyDirty(false);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant={item.isActive ? 'outline' : 'secondary'}
                      size="sm"
                      disabled={isSaving}
                      onClick={() => void toggleSubject(item.id, !item.isActive)}
                    >
                      {item.isActive ? 'Hide' : 'Restore'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {!filteredItems.length ? (
            <div className="px-6 py-4">
              <p className="text-sm text-muted-foreground">
                No subjects match the filter.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
