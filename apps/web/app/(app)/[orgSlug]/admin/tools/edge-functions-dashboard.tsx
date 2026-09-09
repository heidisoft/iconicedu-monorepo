'use client';

import * as React from 'react';
import type { AdminToolKind } from '@iconicedu/shared-types';
import { dispatchAdminTool } from '@iconicedu/web/lib/api/admin-tools';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';

import { Badge, Button, Input, Label, Loader2, toast } from '@iconicedu/ui-web';

type RunStatus = 'idle' | 'running' | 'success' | 'error';

type FunctionResult = {
  status: RunStatus;
  httpStatus?: number;
  data?: unknown;
  ranAt?: string;
};

type FunctionConfig = {
  kind: AdminToolKind;
  title: string;
  description: string;
  hasDispatchParams: boolean;
  hasLeaseParams?: boolean;
  destructive?: boolean;
};

const FUNCTIONS: FunctionConfig[] = [
  {
    kind: 'schedule-reconciliation-dispatch',
    title: 'Schedule Reconciliation',
    description:
      'Creates and updates pre-class reminder and completion-check jobs from class schedules. Runs independently of Events Dispatch.',
    hasDispatchParams: true,
    hasLeaseParams: true,
  },
  {
    kind: 'events-dispatch',
    title: 'Events Dispatch',
    description:
      'Processes activity events and prepares notifications. Use Push Notifications to deliver queued pushes.',
    hasDispatchParams: true,
    hasLeaseParams: true,
  },
  {
    kind: 'reminders-dispatch',
    title: 'Reminders Dispatch',
    description:
      'Sends due pre-class reminders. Session completion checks run separately.',
    hasDispatchParams: true,
    hasLeaseParams: true,
  },
  {
    kind: 'session-completions-dispatch',
    title: 'Session Completion Checks',
    description:
      'Processes checks due ten minutes after each class ends. Each teacher receives a separate check per class.',
    hasDispatchParams: true,
    hasLeaseParams: true,
  },
  {
    kind: 'push-notifications-dispatch',
    title: 'Push Notifications',
    description:
      'Delivers queued push notifications, including pre-class reminders, with its own job limit and retries.',
    hasDispatchParams: true,
    hasLeaseParams: true,
  },
  {
    kind: 'channel-read-state-repair',
    title: 'Channel Read State Repair',
    description: 'Recomputes unread counts for channels in this organization.',
    hasDispatchParams: false,
  },
  {
    kind: 'reminder-jobs-reset',
    title: 'Reminder Jobs — Reset & Reconcile',
    description:
      'Deletes all non-successful reminder and completion-check jobs for this organization, then rebuilds upcoming jobs. Successful jobs are kept.',
    hasDispatchParams: false,
    destructive: true,
  },
];

const STATUS_BADGE: Record<
  RunStatus,
  { label: string; variant: 'outline' | 'default' | 'destructive' | 'secondary' }
> = {
  idle: { label: 'Idle', variant: 'outline' },
  running: { label: 'Running…', variant: 'secondary' },
  success: { label: 'Success', variant: 'default' },
  error: { label: 'Error', variant: 'destructive' },
};

type FunctionCardProps = {
  orgId: string;
  config: FunctionConfig;
};

function FunctionCard({ orgId, config }: FunctionCardProps) {
  const [limit, setLimit] = React.useState('');
  const [leaseSeconds, setLeaseSeconds] = React.useState('');
  const [leaseOwner, setLeaseOwner] = React.useState('');
  const [result, setResult] = React.useState<FunctionResult>({ status: 'idle' });

  const handleRun = async () => {
    setResult({ status: 'running' });

    try {
      const json = await dispatchAdminTool(createSupabaseBrowserClient(), {
        orgId,
        kind: config.kind,
        ...(config.hasDispatchParams && limit ? { limit: Number(limit) } : {}),
        ...(config.hasLeaseParams && leaseSeconds
          ? { leaseSeconds: Number(leaseSeconds) }
          : {}),
        ...(config.hasLeaseParams && leaseOwner ? { leaseOwner } : {}),
      });

      if (json.success) {
        setResult({
          status: 'success',
          httpStatus: json.status,
          data: json.data,
          ranAt: new Date().toISOString(),
        });
        toast.success(`${config.title} completed`);
      } else {
        setResult({
          status: 'error',
          httpStatus: json.status,
          data: json.data ?? json.message,
          ranAt: new Date().toISOString(),
        });
        toast.error(`${config.title} failed: ${json.message ?? 'Unknown error'}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network error';
      setResult({ status: 'error', data: message, ranAt: new Date().toISOString() });
      toast.error(`${config.title} failed: ${message}`);
    }
  };

  const badge = STATUS_BADGE[result.status];
  const isRunning = result.status === 'running';

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
        <h2 className="text-sm font-semibold">{config.title}</h2>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      <div className="px-6 py-4 flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{config.description}</p>

        {config.hasDispatchParams && (
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${config.kind}-limit`} className="text-xs">
                Limit
              </Label>
              <Input
                id={`${config.kind}-limit`}
                type="number"
                placeholder="default"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="w-28"
                min={1}
                max={200}
                disabled={isRunning}
              />
            </div>
            {config.hasLeaseParams && (
              <>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`${config.kind}-lease-seconds`} className="text-xs">
                    Lease seconds
                  </Label>
                  <Input
                    id={`${config.kind}-lease-seconds`}
                    type="number"
                    placeholder="default"
                    value={leaseSeconds}
                    onChange={(e) => setLeaseSeconds(e.target.value)}
                    className="w-32"
                    min={30}
                    max={600}
                    disabled={isRunning}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`${config.kind}-lease-owner`} className="text-xs">
                    Lease owner
                  </Label>
                  <Input
                    id={`${config.kind}-lease-owner`}
                    type="text"
                    placeholder="supabase-edge-cron"
                    value={leaseOwner}
                    onChange={(e) => setLeaseOwner(e.target.value)}
                    className="w-52"
                    disabled={isRunning}
                  />
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant={config.destructive ? 'destructive' : 'default'}
            onClick={handleRun}
            disabled={isRunning}
          >
            {isRunning && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {config.destructive ? 'Reset & reconcile' : 'Run now'}
          </Button>
          {result.ranAt && (
            <span className="text-muted-foreground text-xs">
              Last run {new Date(result.ranAt).toLocaleTimeString()}
              {result.httpStatus != null ? ` · HTTP ${result.httpStatus}` : ''}
            </span>
          )}
        </div>

        {result.data != null && (
          <pre className="bg-muted text-muted-foreground max-h-48 overflow-auto rounded-md p-3 text-xs">
            {typeof result.data === 'string'
              ? result.data
              : JSON.stringify(result.data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

type EdgeFunctionsDashboardProps = {
  orgId: string;
};

export function EdgeFunctionsDashboard({ orgId }: EdgeFunctionsDashboardProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Run background jobs for this organization. Completion checks and push
        notifications run independently of pre-class reminders. These actions process due
        jobs; they do not change the cron schedule.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {FUNCTIONS.map((config) => (
          <FunctionCard key={config.kind} orgId={orgId} config={config} />
        ))}
      </div>
    </div>
  );
}
