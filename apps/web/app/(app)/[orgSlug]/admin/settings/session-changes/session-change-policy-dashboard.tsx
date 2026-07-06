'use client';

import { useMemo, useState, useTransition } from 'react';
import type { ClassScheduleSelfServePolicyVM } from '@iconicedu/shared-types';
import { Button, toast } from '@iconicedu/ui-web';
import { upsertSelfServePolicyAction } from '@iconicedu/web/app/actions/self-serve-class-session-change';

type PolicyWithTitle = ClassScheduleSelfServePolicyVM & { title: string | null };

export function SessionChangePolicyDashboard({
  orgSlug,
  policies,
}: {
  orgSlug: string;
  policies: PolicyWithTitle[];
}) {
  const [items, setItems] = useState(policies);
  const [selectedId, setSelectedId] = useState(policies[0]?.learningSpaceId ?? '');
  const [isPending, startTransition] = useTransition();

  const selected = useMemo(
    () => items.find((policy) => policy.learningSpaceId === selectedId) ?? null,
    [items, selectedId],
  );

  const updateSelected = (patch: Partial<PolicyWithTitle>) => {
    setItems((current) =>
      current.map((policy) =>
        policy.learningSpaceId === selectedId ? { ...policy, ...patch } : policy,
      ),
    );
  };

  const save = () => {
    if (!selected) return;
    startTransition(async () => {
      try {
        const saved = await upsertSelfServePolicyAction({
          orgSlug,
          ...selected,
        });
        setItems((current) =>
          current.map((policy) =>
            policy.learningSpaceId === saved.learningSpaceId
              ? { ...policy, ...saved }
              : policy,
          ),
        );
        toast.success('Session change policy saved.');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Unable to save session policy.',
        );
      }
    });
  };

  if (items.length === 0) {
    return (
      <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
        No active classrooms found.
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(220px,320px)_1fr]">
      <div className="rounded-md border bg-card p-3">
        <label
          htmlFor="session-change-classroom"
          className="text-sm font-medium text-foreground"
        >
          Classroom
        </label>
        <select
          id="session-change-classroom"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          {items.map((policy) => (
            <option key={policy.learningSpaceId} value={policy.learningSpaceId}>
              {policy.title ?? 'Untitled classroom'}
            </option>
          ))}
        </select>
      </div>

      {selected ? (
        <div className="rounded-md border bg-card p-5">
          <div className="flex flex-col gap-1 border-b pb-4">
            <h2 className="text-lg font-semibold">
              {selected.title ?? 'Untitled classroom'}
            </h2>
            <p className="text-sm text-muted-foreground">
              Requests inside the configured window can require approval from the other
              adult participant.
            </p>
          </div>

          <div className="grid gap-5 py-5 md:grid-cols-2">
            <label className="flex items-center justify-between gap-4 rounded-md border p-3">
              <span>
                <span className="block text-sm font-medium">Self-serve changes</span>
                <span className="block text-xs text-muted-foreground">
                  Allows participants to start cancellation or reschedule requests.
                </span>
              </span>
              <input
                type="checkbox"
                checked={selected.enabled}
                onChange={(event) => updateSelected({ enabled: event.target.checked })}
              />
            </label>

            <label className="rounded-md border p-3">
              <span className="block text-sm font-medium">Approval window</span>
              <span className="block text-xs text-muted-foreground">
                Hours before class where direct changes need approval.
              </span>
              <input
                type="number"
                min={0}
                max={720}
                value={selected.cutoffHours}
                onChange={(event) =>
                  updateSelected({
                    cutoffHours: Math.max(
                      0,
                      Math.min(720, Number(event.target.value) || 0),
                    ),
                  })
                }
                className="mt-2 h-10 w-28 rounded-md border bg-background px-3 text-sm"
              />
            </label>

            <label className="flex items-center justify-between gap-4 rounded-md border p-3">
              <span className="text-sm font-medium">Parents can request changes</span>
              <input
                type="checkbox"
                checked={selected.allowGuardian}
                onChange={(event) =>
                  updateSelected({ allowGuardian: event.target.checked })
                }
              />
            </label>

            <label className="flex items-center justify-between gap-4 rounded-md border p-3">
              <span className="text-sm font-medium">Teachers can request changes</span>
              <input
                type="checkbox"
                checked={selected.allowEducator}
                onChange={(event) =>
                  updateSelected({ allowEducator: event.target.checked })
                }
              />
            </label>

            <label className="flex items-center justify-between gap-4 rounded-md border p-3">
              <span className="text-sm font-medium">Students can request changes</span>
              <input
                type="checkbox"
                checked={selected.allowChild}
                onChange={(event) => updateSelected({ allowChild: event.target.checked })}
              />
            </label>

            <label className="flex items-center justify-between gap-4 rounded-md border p-3">
              <span>
                <span className="block text-sm font-medium">
                  Require approval in window
                </span>
                <span className="block text-xs text-muted-foreground">
                  Applies to requests inside {selected.cutoffHours} hours.
                </span>
              </span>
              <input
                type="checkbox"
                checked={selected.withinCutoffRequiresApproval}
                onChange={(event) =>
                  updateSelected({
                    withinCutoffRequiresApproval: event.target.checked,
                  })
                }
              />
            </label>
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button onClick={save} disabled={isPending}>
              Save policy
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
