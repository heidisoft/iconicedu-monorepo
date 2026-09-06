'use client';

import * as React from 'react';

import { Badge, Button, Input, Label, Loader2, toast } from '@iconicedu/ui-web';

type FunctionKind =
  | 'events-dispatch'
  | 'reminders-dispatch'
  | 'channel-read-state-repair'
  | 'reminder-jobs-reset';

type RunStatus = 'idle' | 'running' | 'success' | 'error';

type FunctionResult = {
  status: RunStatus;
  httpStatus?: number;
  data?: unknown;
  ranAt?: string;
};

type FunctionConfig = {
  kind: FunctionKind;
  title: string;
  description: string;
  hasDispatchParams: boolean;
  hasLeaseParams?: boolean;
  destructive?: boolean;
};

const FUNCTIONS: FunctionConfig[] = [
  {
    kind: 'events-dispatch',
    title: 'Unified Events Dispatch',
    description:
      'Claims event_pipeline_jobs for activity generation, projection, notification delivery, and reminder reconciliation.',
    hasDispatchParams: true,
    hasLeaseParams: true,
  },
  {
    kind: 'reminders-dispatch',
    title: 'Reminders Dispatch',
    description: 'Claims due reminder_jobs and publishes reminder activity_events.',
    hasDispatchParams: true,
    hasLeaseParams: true,
  },
  {
    kind: 'channel-read-state-repair',
    title: 'Channel Read State Repair',
    description:
      'Recomputes unread counts for all channels across all orgs. Runs daily at 3 AM UTC — use this to force a repair.',
    hasDispatchParams: false,
  },
  {
    kind: 'reminder-jobs-reset',
    title: 'Reminder Jobs — Reset & Reconcile',
    description:
      'Cancels all active (pending/leased/failed) reminder_jobs for this org, then runs the reconciler for every schedule to repopulate fresh jobs. Use after data migrations or when the job table is in a bad state.',
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
      const response = await fetch('/api/admin/tools/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          kind: config.kind,
          ...(config.hasDispatchParams && limit ? { limit: Number(limit) } : {}),
          ...(config.hasLeaseParams && leaseSeconds
            ? { leaseSeconds: Number(leaseSeconds) }
            : {}),
          ...(config.hasLeaseParams && leaseOwner ? { leaseOwner } : {}),
        }),
      });

      const json = (await response.json()) as {
        success: boolean;
        status?: number;
        data?: unknown;
        message?: string;
      };

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
                    min={1}
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
            {config.destructive ? 'Reset & reconcile' : 'Run cron job'}
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
        Run the same work kicked off by the Supabase cron edge functions. The API-backed
        jobs call their internal dispatch endpoints with cron-style payloads; the repair
        job runs the same unread-count repair RPC used by its edge function.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {FUNCTIONS.map((config) => (
          <FunctionCard key={config.kind} orgId={orgId} config={config} />
        ))}
      </div>
    </div>
  );
}
