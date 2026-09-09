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
  /** Queue table. */
  table: 'event_pipeline_jobs' | 'reminder_jobs';
  /** Discriminator column and value that isolate this job kind within the table. */
  column: 'job_kind' | 'job_type';
  value: string;
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

function pipelineRow(row: JobRow): AdminJobActivityRecordVM {
  return {
    ...baseRecord(row),
    label: toText(row.source_kind) ?? toText(row.job_kind) ?? 'pipeline job',
    detail: toText(row.dedupe_key),
  };
}

function reminderRow(row: JobRow): AdminJobActivityRecordVM {
  return {
    ...baseRecord(row),
    label:
      [toText(row.target_kind), toText(row.occurrence_start_at)]
        .filter(Boolean)
        .join(' · ') || 'reminder job',
    detail: toText(row.dedupe_key),
  };
}

const JOB_ACTIVITY_CONFIGS: JobActivityConfig[] = [
  {
    kind: 'activity-generate',
    table: 'event_pipeline_jobs',
    column: 'job_kind',
    value: 'activity.generate',
    title: 'Activity generate',
    description: 'Turns raw message, reaction, and schedule events into activity items.',
    workerName: 'events-dispatch',
    mapRow: pipelineRow,
  },
  {
    kind: 'activity-project',
    table: 'event_pipeline_jobs',
    column: 'job_kind',
    value: 'activity.project',
    title: 'Activity project',
    description: 'Projects generated activity items into each recipient inbox.',
    workerName: 'events-dispatch',
    mapRow: pipelineRow,
  },
  {
    kind: 'notification-prepare',
    table: 'event_pipeline_jobs',
    column: 'job_kind',
    value: 'notification.prepare',
    title: 'Notification prepare',
    description: 'Decides which push and email notifications each activity item needs.',
    workerName: 'events-dispatch',
    mapRow: pipelineRow,
  },
  {
    kind: 'notification-deliver',
    table: 'event_pipeline_jobs',
    column: 'job_kind',
    value: 'notification.deliver',
    title: 'Notification deliver',
    description: 'Delivers queued push and email notifications, with retries.',
    workerName: 'push-notifications-dispatch',
    mapRow: pipelineRow,
  },
  {
    kind: 'reminder-reconcile',
    table: 'event_pipeline_jobs',
    column: 'job_kind',
    value: 'reminder.reconcile',
    title: 'Schedule reconciliation',
    description:
      'Rebuilds pre-class reminder and completion-check jobs whenever a class schedule changes.',
    workerName: 'schedule-reconciliation-dispatch',
    mapRow: pipelineRow,
  },
  {
    kind: 'session-reminder',
    table: 'reminder_jobs',
    column: 'job_type',
    value: 'session.reminder',
    title: 'Session reminders',
    description: 'Pre-class reminder messages sent ahead of each session.',
    workerName: 'reminders-dispatch',
    mapRow: reminderRow,
  },
  {
    kind: 'session-completion-check',
    table: 'reminder_jobs',
    column: 'job_type',
    value: 'session.completion_check',
    title: 'Session completion checks',
    description:
      'Post-class completion checks sent to each participant after a class ends.',
    workerName: 'session-completions-dispatch',
    mapRow: reminderRow,
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
        .eq(config.column, config.value)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit)
        .returns<JobRow[]>();

      if (result.error) {
        this.logger.warn(
          `job-activity: ${config.table}/${config.value} unavailable (${result.error.message})`,
        );
        return emptyGroup(result.error.message);
      }
      data = result.data;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'query failed';
      this.logger.warn(
        `job-activity: ${config.table}/${config.value} query threw (${message})`,
      );
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
