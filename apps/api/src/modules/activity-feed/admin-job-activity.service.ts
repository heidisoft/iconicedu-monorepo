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

/** Context shared across row mappers (e.g. resolved recipient names). */
type MapContext = { profileNames: Map<string, string> };

type JobActivityConfig = {
  kind: AdminJobActivityKind;
  table: 'event_pipeline_jobs' | 'reminder_jobs';
  /** Discriminator column and value that isolate this job kind within the table. */
  column: 'job_kind' | 'job_type';
  value: string;
  title: string;
  description: string;
  workerName: string;
  mapRow: (row: JobRow, ctx: MapContext) => AdminJobActivityRecordVM;
};

function toText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function toCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function baseRecord(row: JobRow): AdminJobActivityRecordVM {
  return {
    id: String(row.id),
    status: toText(row.status) ?? 'unknown',
    label: 'Job',
    message: null,
    participants: [],
    occurrenceAt: null,
    priority: null,
    detail: toText(row.dedupe_key),
    attemptCount: toCount(row.attempt_count),
    maxAttempts: toCount(row.max_attempts),
    lastError: toText(row.last_error),
    runAt: toText(row.run_at),
    dispatchedAt: toText(row.dispatched_at),
    createdAt: toText(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: toText(row.updated_at),
  };
}

function memberNames(payload: Record<string, unknown>): string[] {
  const members = Array.isArray(payload.members) ? payload.members : [];
  return members
    .map((entry) => {
      const member = asRecord(entry);
      const name = toText(member.displayName);
      if (!name) return null;
      const role = toText(member.role);
      return role ? `${name} · ${role}` : name;
    })
    .filter((name): name is string => name !== null);
}

/** reminder_jobs rows (session.reminder / session.completion_check). */
function reminderRow(row: JobRow): AdminJobActivityRecordVM {
  const payload = asRecord(row.payload);
  const offset = payload.reminderOffsetMinutes;
  return {
    ...baseRecord(row),
    label:
      toText(payload.title) ??
      toText(payload.description) ??
      toText(row.target_kind) ??
      'reminder job',
    message: toText(payload.summary),
    participants: memberNames(payload),
    occurrenceAt:
      toText(row.occurrence_start_at) ??
      toText(payload.occurrenceStart) ??
      toText(payload.startAt),
    priority: offset === 15 ? 'high' : null,
  };
}

/** event_pipeline_jobs rows, dispatched by job_kind. */
function pipelineRow(row: JobRow, ctx: MapContext): AdminJobActivityRecordVM {
  const base = baseRecord(row);
  const payload = asRecord(row.payload);
  const jobKind = toText(row.job_kind);

  if (jobKind === 'notification.deliver') {
    const channel = toText(payload.deliveryChannel) ?? 'push';
    const recipientId = toText(payload.recipientProfileId);
    const recipient = recipientId ? (ctx.profileNames.get(recipientId) ?? null) : null;
    const queuePriority = toCount(row.priority);
    return {
      ...base,
      label: recipient ? `${channel} to ${recipient}` : `${channel} notification`,
      participants: recipient ? [recipient] : [],
      priority: queuePriority !== null && queuePriority <= 80 ? 'immediate' : 'delayed',
    };
  }

  if (jobKind === 'reminder.reconcile') {
    return {
      ...base,
      label: 'Schedule reconciliation',
      detail: toText(payload.scheduleId) ?? base.detail,
    };
  }

  return {
    ...base,
    label:
      toText(payload.eventKind) ?? toText(row.source_kind) ?? jobKind ?? 'pipeline job',
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

type LoadedGroup = {
  config: JobActivityConfig;
  rows: JobRow[] | null;
  unavailableReason: string | null;
};

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
    const loaded = await Promise.all(
      configs.map((config) => this.loadGroupRows(supabase, config, orgId, limit)),
    );

    const profileNames = await this.resolveRecipientNames(supabase, orgId, loaded);
    const groups = loaded.map((entry) => this.buildGroup(entry, { profileNames }));

    return { generatedAt: new Date().toISOString(), groups };
  }

  private async loadGroupRows(
    supabase: SupabaseServiceClient,
    config: JobActivityConfig,
    orgId: string,
    limit: number,
  ): Promise<LoadedGroup> {
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
        return { config, rows: null, unavailableReason: result.error.message };
      }
      return { config, rows: result.data ?? [], unavailableReason: null };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'query failed';
      this.logger.warn(
        `job-activity: ${config.table}/${config.value} query threw (${message})`,
      );
      return { config, rows: null, unavailableReason: message };
    }
  }

  private async resolveRecipientNames(
    supabase: SupabaseServiceClient,
    orgId: string,
    loaded: LoadedGroup[],
  ): Promise<Map<string, string>> {
    const ids = new Set<string>();
    for (const entry of loaded) {
      if (entry.config.value !== 'notification.deliver' || !entry.rows) continue;
      for (const row of entry.rows) {
        const recipientId = toText(asRecord(row.payload).recipientProfileId);
        if (recipientId) ids.add(recipientId);
      }
    }
    if (!ids.size) return new Map();

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, first_name, last_name')
        .eq('org_id', orgId)
        .in('id', Array.from(ids))
        .returns<
          Array<{
            id: string;
            display_name: string | null;
            first_name: string | null;
            last_name: string | null;
          }>
        >();
      if (error) throw new Error(error.message);
      return new Map(
        (data ?? []).map((profile) => {
          const fallback =
            [profile.first_name, profile.last_name]
              .map((part) => part?.trim())
              .filter(Boolean)
              .join(' ') || 'Unknown user';
          return [profile.id, toText(profile.display_name) ?? fallback];
        }),
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'lookup failed';
      this.logger.warn(`job-activity: recipient name lookup failed (${message})`);
      return new Map();
    }
  }

  private buildGroup(entry: LoadedGroup, ctx: MapContext): AdminJobActivityGroupVM {
    const { config } = entry;
    const shell = {
      kind: config.kind,
      title: config.title,
      description: config.description,
      workerName: config.workerName,
    };

    if (!entry.rows) {
      return {
        ...shell,
        sampledCount: 0,
        statusCounts: [],
        latestProcessedAt: null,
        records: [],
        unavailable: true,
        unavailableReason: entry.unavailableReason,
      };
    }

    const records = entry.rows.map((row) => config.mapRow(row, ctx));

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
      ...shell,
      sampledCount: records.length,
      statusCounts,
      latestProcessedAt,
      records,
      unavailable: false,
      unavailableReason: null,
    };
  }
}
