import { Injectable, Logger } from '@nestjs/common';
import {
  ADMIN_JOB_ACTIVITY_KINDS,
  type AdminJobActivityGroupVM,
  type AdminJobActivityKind,
  type AdminJobActivityOverviewVM,
  type AdminJobActivityRecordVM,
} from '@iconicedu/shared-types';
import { requireAdminAccount } from '@iconicedu/api/lib/auth/require-admin-account';
import {
  createSupabaseServiceClient,
  type SupabaseServiceClient,
} from '@iconicedu/api/lib/supabase/service';

const DEFAULT_SAMPLE_LIMIT = 50;
const MAX_SAMPLE_LIMIT = 200;

type JobRow = Record<string, unknown>;

type JobActivityConfig = {
  kind: AdminJobActivityKind;
  table: string;
  title: string;
  description: string;
  workerName: string;
  mapRow: (row: JobRow) => AdminJobActivityRecordVM;
};

function toText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function toCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function baseRecord(row: JobRow): AdminJobActivityRecordVM {
  return {
    id: String(row.id),
    status: toText(row.status) ?? 'unknown',
    label: 'Job',
    detail: null,
    attemptCount: toCount(row.attempt_count),
    maxAttempts: toCount(row.max_attempts),
    lastError: toText(row.last_error),
    runAt: toText(row.run_at),
    dispatchedAt: toText(row.dispatched_at),
    createdAt: toText(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: toText(row.updated_at),
  };
}

const JOB_ACTIVITY_CONFIGS: JobActivityConfig[] = [
  {
    kind: 'activity-source',
    table: 'activity_source_jobs',
    title: 'Activity source jobs',
    description:
      'Raw message, reaction, and schedule-change events waiting to be turned into activity.',
    workerName: 'events-dispatch',
    mapRow: (row) => ({
      ...baseRecord(row),
      label: toText(row.job_kind) ?? 'activity source',
      detail: toText(row.dedupe_key),
    }),
  },
  {
    kind: 'event-pipeline',
    table: 'event_pipeline_jobs',
    title: 'Event pipeline',
    description:
      'Fan-out steps that generate activity items and prepare notifications from each event.',
    workerName: 'events-dispatch',
    mapRow: (row) => ({
      ...baseRecord(row),
      label: toText(row.job_kind) ?? 'pipeline step',
      detail: toText(row.source_kind) ?? toText(row.dedupe_key),
    }),
  },
  {
    kind: 'notification-dispatch',
    table: 'notification_dispatch_jobs',
    title: 'Notification dispatch',
    description: 'Queued push, email, and SMS notifications and their delivery attempts.',
    workerName: 'push-notifications-dispatch',
    mapRow: (row) => ({
      ...baseRecord(row),
      label:
        [toText(row.delivery_channel), toText(row.pref_key)]
          .filter(Boolean)
          .join(' · ') || 'notification',
      detail:
        [toText(row.delivery_timing), toText(row.attempt_bucket)]
          .filter(Boolean)
          .join(' · ') || null,
    }),
  },
  {
    kind: 'reminder',
    table: 'reminder_jobs',
    title: 'Reminders',
    description: 'Pre-class reminders and other scheduled reminder messages.',
    workerName: 'reminders-dispatch',
    mapRow: (row) => ({
      ...baseRecord(row),
      label: toText(row.job_type) ?? 'reminder',
      detail: toText(row.target_kind),
    }),
  },
  {
    kind: 'reminder-reconcile',
    table: 'reminder_reconcile_jobs',
    title: 'Schedule reconciliation',
    description:
      'Rebuilds reminder and completion-check jobs whenever a class schedule changes.',
    workerName: 'schedule-reconciliation-dispatch',
    mapRow: (row) => ({
      ...baseRecord(row),
      label: 'schedule.reconcile',
      detail: toText(row.schedule_id),
    }),
  },
  {
    kind: 'session-completion',
    table: 'class_session_completions',
    title: 'Session completions',
    description:
      'Post-class completion checks sent to each participant after a class ends.',
    workerName: 'session-completions-dispatch',
    mapRow: (row) => ({
      ...baseRecord(row),
      label: toText(row.session_title) ?? 'Session completion',
      detail: toText(row.role),
      attemptCount: null,
      maxAttempts: null,
      lastError: null,
      runAt: toText(row.session_end_at),
      dispatchedAt: toText(row.notified_at),
    }),
  },
];

function isJobActivityKind(value: string): value is AdminJobActivityKind {
  return (ADMIN_JOB_ACTIVITY_KINDS as readonly string[]).includes(value);
}

@Injectable()
export class AdminJobActivityService {
  private readonly logger = new Logger(AdminJobActivityService.name);

  async fetchJobActivity(
    authUserId: string,
    orgId: string,
    options: { kind?: string; limit?: number } = {},
  ): Promise<AdminJobActivityOverviewVM> {
    await requireAdminAccount(authUserId, orgId);

    const limit = Math.min(
      Math.max(Math.trunc(options.limit ?? DEFAULT_SAMPLE_LIMIT), 1),
      MAX_SAMPLE_LIMIT,
    );

    let configs = JOB_ACTIVITY_CONFIGS;
    if (options.kind) {
      configs = isJobActivityKind(options.kind)
        ? JOB_ACTIVITY_CONFIGS.filter((config) => config.kind === options.kind)
        : [];
    }

    const supabase = createSupabaseServiceClient();
    const groups = await Promise.all(
      configs.map((config) => this.loadGroup(supabase, config, orgId, limit)),
    );

    return { generatedAt: new Date().toISOString(), groups };
  }

  private async loadGroup(
    supabase: SupabaseServiceClient,
    config: JobActivityConfig,
    orgId: string,
    limit: number,
  ): Promise<AdminJobActivityGroupVM> {
    const emptyGroup = (
      unavailableReason: string | null = null,
    ): AdminJobActivityGroupVM => ({
      kind: config.kind,
      title: config.title,
      description: config.description,
      workerName: config.workerName,
      sampledCount: 0,
      statusCounts: [],
      latestProcessedAt: null,
      records: [],
      unavailable: unavailableReason !== null,
      unavailableReason,
    });

    let data: JobRow[] | null = null;
    try {
      const result = await supabase
        .from(config.table)
        .select('*')
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit)
        .returns<JobRow[]>();

      if (result.error) {
        this.logger.warn(
          `job-activity: ${config.table} unavailable (${result.error.message})`,
        );
        return emptyGroup(result.error.message);
      }
      data = result.data;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'query failed';
      this.logger.warn(`job-activity: ${config.table} query threw (${message})`);
      return emptyGroup(message);
    }

    const records = (data ?? []).map((row) => config.mapRow(row));

    const statusCountMap = new Map<string, number>();
    let latestProcessedAt: string | null = null;
    for (const record of records) {
      statusCountMap.set(record.status, (statusCountMap.get(record.status) ?? 0) + 1);
      if (
        record.dispatchedAt &&
        (latestProcessedAt === null || record.dispatchedAt > latestProcessedAt)
      ) {
        latestProcessedAt = record.dispatchedAt;
      }
    }

    const statusCounts = Array.from(statusCountMap.entries())
      .map(([status, count]) => ({ status, count }))
      .sort(
        (left, right) =>
          right.count - left.count || left.status.localeCompare(right.status),
      );

    return {
      kind: config.kind,
      title: config.title,
      description: config.description,
      workerName: config.workerName,
      sampledCount: records.length,
      statusCounts,
      latestProcessedAt,
      records,
      unavailable: false,
      unavailableReason: null,
    };
  }
}
