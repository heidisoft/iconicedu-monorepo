'use client';

import * as React from 'react';

import type {
  ActivityVerbCatalogItemVM,
  ActivityVerbSuppressionRuleVM,
  ActivityVerbSuppressionSnapshotVM,
} from '@iconicedu/shared-types';
import {
  Badge,
  Button,
  Input,
  Label,
  Loader2,
  Search,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Trash2,
  toast,
} from '@iconicedu/ui-web';

type ActivityVerbSuppressionDashboardProps = {
  orgId: string;
};

function sortByDisplayName<T extends { displayName: string }>(rows: T[]) {
  return [...rows].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function findOrgRule(
  eventType: string,
  rules: ActivityVerbSuppressionRuleVM[],
): ActivityVerbSuppressionRuleVM | undefined {
  return rules.find((rule) => rule.scope === 'org' && rule.eventType === eventType);
}

function isEffectiveEnabled(eventType: string, rules: ActivityVerbSuppressionRuleVM[]) {
  return findOrgRule(eventType, rules)?.isEnabled ?? true;
}

export function ActivityVerbSuppressionDashboard({
  orgId,
}: ActivityVerbSuppressionDashboardProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [snapshot, setSnapshot] = React.useState<ActivityVerbSuppressionSnapshotVM>({
    orgRules: [],
    actorRules: [],
    verbCatalog: [],
    profiles: [],
  });
  const [newActorProfileId, setNewActorProfileId] = React.useState<string>('');
  const [newActorEventType, setNewActorEventType] = React.useState<string>('');
  const [newActorEnabled, setNewActorEnabled] = React.useState<boolean>(false);

  const loadSnapshot = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/activity/suppression?orgId=${encodeURIComponent(orgId)}`,
      );
      const payload = (await response.json()) as {
        success?: boolean;
        message?: string;
        data?: ActivityVerbSuppressionSnapshotVM;
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message ?? 'Failed to load activity controls.');
      }
      setSnapshot(payload.data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to load activity controls.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  React.useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const filteredVerbCatalog = React.useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) {
      return snapshot.verbCatalog;
    }
    return snapshot.verbCatalog.filter((item) =>
      item.eventType.toLowerCase().includes(normalized),
    );
  }, [search, snapshot.verbCatalog]);

  const profileNameById = React.useMemo(() => {
    return new Map(
      snapshot.profiles.map((profile) => [profile.profileId, profile.displayName]),
    );
  }, [snapshot.profiles]);

  const knownVerbOptions = React.useMemo(
    () =>
      snapshot.verbCatalog.filter(
        (verb) => verb.isKnown && !verb.isReadOnly,
      ) satisfies ActivityVerbCatalogItemVM[],
    [snapshot.verbCatalog],
  );

  const upsertRule = React.useCallback(
    async (input: {
      eventType: string;
      actorProfileId?: string | null;
      isEnabled: boolean;
    }) => {
      setIsSaving(true);
      try {
        const response = await fetch('/api/admin/activity/suppression', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId,
            eventType: input.eventType,
            actorProfileId: input.actorProfileId ?? null,
            isEnabled: input.isEnabled,
          }),
        });
        const payload = (await response.json()) as {
          success?: boolean;
          message?: string;
        };
        if (!response.ok || !payload.success) {
          throw new Error(payload.message ?? 'Failed to update activity control.');
        }
        await loadSnapshot();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to update activity control.',
        );
      } finally {
        setIsSaving(false);
      }
    },
    [loadSnapshot, orgId],
  );

  const deleteRule = React.useCallback(
    async (input: { eventType: string; actorProfileId?: string | null }) => {
      setIsSaving(true);
      try {
        const response = await fetch('/api/admin/activity/suppression', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId,
            eventType: input.eventType,
            actorProfileId: input.actorProfileId ?? null,
          }),
        });
        const payload = (await response.json()) as {
          success?: boolean;
          message?: string;
        };
        if (!response.ok || !payload.success) {
          throw new Error(payload.message ?? 'Failed to remove activity control.');
        }
        await loadSnapshot();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to remove activity control.',
        );
      } finally {
        setIsSaving(false);
      }
    },
    [loadSnapshot, orgId],
  );

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading activity controls...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
          <h2 className="text-sm font-semibold">Global Verb Controls</h2>
          <p className="text-xs text-muted-foreground">
            Disable activity verbs at org level. Unknown custom verbs are shown as
            read-only.
          </p>
        </div>
        <div className="px-6 py-4 border-b">
          <div className="flex items-center gap-2 h-9 w-full max-w-sm rounded-lg border bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
              placeholder="Search event type"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="divide-y divide-border">
          {filteredVerbCatalog.map((verb) => {
            const enabled = isEffectiveEnabled(verb.eventType, snapshot.orgRules);
            return (
              <div
                key={verb.eventType}
                className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{verb.eventType}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {verb.isKnown ? (
                      <Badge variant="secondary">Known</Badge>
                    ) : (
                      <Badge variant="outline">Custom (read-only)</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">
                    {enabled ? 'Enabled' : 'Disabled'}
                  </Label>
                  <Switch
                    checked={enabled}
                    disabled={isSaving || verb.isReadOnly}
                    onCheckedChange={(nextValue) =>
                      void upsertRule({
                        eventType: verb.eventType,
                        actorProfileId: null,
                        isEnabled: nextValue,
                      })
                    }
                  />
                </div>
              </div>
            );
          })}
          {!filteredVerbCatalog.length ? (
            <div className="px-6 py-4">
              <p className="text-sm text-muted-foreground">No verbs match the filter.</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
          <h2 className="text-sm font-semibold">Actor Overrides</h2>
          <p className="text-xs text-muted-foreground">
            Override global behavior for a specific actor and verb.
          </p>
        </div>
        <div className="px-6 py-4 flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
            <Select value={newActorProfileId} onValueChange={setNewActorProfileId}>
              <SelectTrigger>
                <SelectValue placeholder="Select actor" />
              </SelectTrigger>
              <SelectContent>
                {sortByDisplayName(snapshot.profiles).map((profile) => (
                  <SelectItem key={profile.profileId} value={profile.profileId}>
                    {profile.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={newActorEventType} onValueChange={setNewActorEventType}>
              <SelectTrigger>
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent>
                {knownVerbOptions.map((verb) => (
                  <SelectItem key={verb.eventType} value={verb.eventType}>
                    {verb.eventType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 rounded-md border border-border px-3">
              <Label className="text-xs text-muted-foreground">
                {newActorEnabled ? 'Enabled' : 'Disabled'}
              </Label>
              <Switch
                checked={newActorEnabled}
                onCheckedChange={setNewActorEnabled}
                disabled={isSaving}
              />
            </div>

            <Button
              disabled={!newActorProfileId || !newActorEventType || isSaving}
              onClick={() =>
                void upsertRule({
                  eventType: newActorEventType,
                  actorProfileId: newActorProfileId,
                  isEnabled: newActorEnabled,
                })
              }
            >
              Save override
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Actor</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.actorRules.length ? (
                snapshot.actorRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      {rule.actorProfileId
                        ? (profileNameById.get(rule.actorProfileId) ?? 'Unknown')
                        : 'Unknown'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{rule.eventType}</TableCell>
                    <TableCell>
                      <Switch
                        checked={rule.isEnabled}
                        disabled={isSaving}
                        onCheckedChange={(nextValue) =>
                          void upsertRule({
                            eventType: rule.eventType,
                            actorProfileId: rule.actorProfileId ?? null,
                            isEnabled: nextValue,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isSaving}
                        onClick={() =>
                          void deleteRule({
                            eventType: rule.eventType,
                            actorProfileId: rule.actorProfileId ?? null,
                          })
                        }
                      >
                        <Trash2 className="mr-2 size-3.5" />
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                    No actor-specific overrides configured.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
