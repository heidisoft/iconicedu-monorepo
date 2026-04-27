'use client';

import * as React from 'react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Loader2,
  toast,
} from '@iconicedu/ui-web';

type FunctionKind =
  | 'activity-worker-dispatch'
  | 'activity-projector-dispatch'
  | 'reminders-dispatch'
  | 'notifications-dispatch'
  | 'channel-read-state-repair';

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
};

const FUNCTIONS: FunctionConfig[] = [
  {
    kind: 'activity-worker-dispatch',
    title: 'Activity Worker Dispatch',
    description:
      'Claims pending activity_source_jobs and publishes durable activity_events.',
    hasDispatchParams: true,
  },
  {
    kind: 'activity-projector-dispatch',
    title: 'Activity Projector Dispatch',
    description:
      'Retries pending and failed activity_events projection into activity_feed_items and notification dispatch jobs.',
    hasDispatchParams: true,
  },
  {
    kind: 'reminders-dispatch',
    title: 'Reminders Dispatch',
    description: 'Claims due reminder_jobs and publishes reminder activity_events.',
    hasDispatchParams: true,
  },
  {
    kind: 'notifications-dispatch',
    title: 'Notifications Dispatch',
    description:
      'Claims pending notification_dispatch_jobs and delivers push notifications via Expo.',
    hasDispatchParams: true,
  },
  {
    kind: 'channel-read-state-repair',
    title: 'Channel Read State Repair',
    description:
      'Recomputes unread counts for all channels across all orgs. Runs daily at 3 AM UTC — use this to force a repair.',
    hasDispatchParams: false,
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
          ...(config.hasDispatchParams && leaseOwner ? { leaseOwner } : {}),
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{config.title}</CardTitle>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
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
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${config.kind}-lease-owner`} className="text-xs">
                Lease owner
              </Label>
              <Input
                id={`${config.kind}-lease-owner`}
                type="text"
                placeholder="admin-tools"
                value={leaseOwner}
                onChange={(e) => setLeaseOwner(e.target.value)}
                className="w-48"
                disabled={isRunning}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleRun} disabled={isRunning}>
            {isRunning && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Run now
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
      </CardContent>
    </Card>
  );
}

type EdgeFunctionsDashboardProps = {
  orgId: string;
};

export function EdgeFunctionsDashboard({ orgId }: EdgeFunctionsDashboardProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Manually trigger Supabase edge functions. Each function normally runs on a cron
        schedule; use these controls to fire them immediately during development or to
        force a repair.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {FUNCTIONS.map((config) => (
          <FunctionCard key={config.kind} orgId={orgId} config={config} />
        ))}
      </div>
    </div>
  );
}
