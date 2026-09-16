'use server';

import { revalidatePath } from 'next/cache';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { getAccountByAuthUserIdInOrg } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { getLearningSpaceDetail } from '@iconicedu/web/lib/admin/learning-space-detail';
import {
  normalizeScheduleFormDate,
  toOccurrenceKeyInTimezone,
  weekdayTokenFromLocalDate,
} from '@iconicedu/web/lib/admin/learning-space-schedule-hash';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';
import { getClassScheduleSessionContext } from '@iconicedu/web/lib/api/schedules';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { getLocalDate } from '@iconicedu/utils';
import { enableClassScheduleSeriesReschedule } from '@iconicedu/web/flags';

export type UpdateClassScheduleSessionActionInput = {
  orgSlug: string;
  scheduleId: string;
  occurrenceKey: string;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  reason?: string | null;
  suppressNotifications?: boolean;
  /** `'all'` rewrites the whole recurring series' day/time in place — the new
   * weekday is derived from `date`. Omit or `'occurrence'` for today's
   * per-occurrence override behavior. */
  scope?: 'occurrence' | 'all';
  /** `scope: 'all'` only — confirms dropping future overrides/cancellations
   * that no longer apply once the weekday changes. */
  confirmDropFutureOverrides?: boolean;
};

export type UpdateClassScheduleSessionActionResult = {
  scheduleId: string;
  occurrenceKey: string;
  mode: 'recurring' | 'single';
  status: 'scheduled' | 'rescheduled';
  startAt: string;
  endAt: string;
  timezone: string;
  reason: string | null;
};

export type UpdateClassScheduleSessionActionOutcome =
  | UpdateClassScheduleSessionActionResult
  | {
      requiresConfirmation: true;
      futureOverrideCount: number;
      futureExceptionCount: number;
    };

function normalizeReason(reason?: string | null) {
  const trimmed = reason?.trim();
  return trimmed ? trimmed : null;
}

function isValidTimeRange(startTime: string, endTime: string) {
  return Boolean(startTime) && Boolean(endTime) && startTime < endTime;
}

export async function updateClassScheduleSessionAction(
  input: UpdateClassScheduleSessionActionInput,
): Promise<UpdateClassScheduleSessionActionOutcome> {
  if (!input.date || !input.startTime || !input.endTime || !input.timezone) {
    throw new Error('Missing required session fields.');
  }

  if (!isValidTimeRange(input.startTime, input.endTime)) {
    throw new Error('End time must be after start time.');
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const org = await buildOrgBySlug(supabase, input.orgSlug);
  if (!org) {
    throw new Error('Organization not found');
  }

  const accountResponse = await getAccountByAuthUserIdInOrg(supabase, user.id, org.id);
  const account = accountResponse.data;
  if (!account) {
    throw new Error('Account record not found');
  }

  const canManageSessions =
    account.primary_role === 'staff' || account.primary_role === 'owner';
  if (!canManageSessions) {
    throw new Error('Only staff or owner users can edit sessions.');
  }

  const profileResponse = await getProfileByAccountId(supabase, account.id);
  const actorProfile = profileResponse.data;
  if (!actorProfile) {
    throw new Error('Profile record not found');
  }

  const sessionContext = await getClassScheduleSessionContext(supabase, {
    orgId: org.id,
    scheduleId: input.scheduleId,
  });

  if (!sessionContext.sourceLearningSpaceId) {
    throw new Error('Session not found.');
  }

  const detail = await getLearningSpaceDetail(sessionContext.sourceLearningSpaceId);
  const targetSchedule = detail.schedules.find(
    (schedule) => schedule.id === input.scheduleId,
  );

  if (!targetSchedule) {
    throw new Error('Session not found.');
  }

  const normalizedReason = normalizeReason(input.reason);
  const isRecurringSchedule = Boolean(targetSchedule.rule);
  const scheduleTimezone =
    targetSchedule.timezone || sessionContext.timezone || input.timezone;
  const api = createApiClient(supabase);
  const revalidateScheduleViews = () => {
    revalidatePath(`/${input.orgSlug}/class-schedule`);
    if (sessionContext.sourceChannelId) {
      revalidatePath(`/${input.orgSlug}/s/${sessionContext.sourceChannelId}`);
    }
  };

  if (input.scope === 'all') {
    const seriesRescheduleEnabled = await enableClassScheduleSeriesReschedule.run({
      identify: { profileId: actorProfile.id },
    });
    if (!seriesRescheduleEnabled) {
      throw new Error('This feature is not available yet.');
    }
    if (!isRecurringSchedule) {
      throw new Error('Only recurring sessions support editing the whole series.');
    }

    const startAt = toOccurrenceKeyInTimezone(
      input.date,
      input.startTime,
      input.timezone,
    );
    const endAt = toOccurrenceKeyInTimezone(input.date, input.endTime, input.timezone);

    const response = await api.post<{
      success?: true;
      mode?: 'recurring';
      requiresConfirmation?: true;
      futureOverrideCount?: number;
      futureExceptionCount?: number;
    }>('/schedules/session/reschedule', {
      orgId: org.id,
      scheduleId: input.scheduleId,
      occurrenceKey: input.occurrenceKey ?? null,
      startAt,
      endAt,
      timezone: input.timezone,
      reason: normalizedReason,
      suppressNotifications: input.suppressNotifications === true,
      scope: 'all',
      byWeekday: [weekdayTokenFromLocalDate(input.date)],
      confirmDropFutureOverrides: input.confirmDropFutureOverrides === true,
    });

    if (response.requiresConfirmation) {
      return {
        requiresConfirmation: true,
        futureOverrideCount: response.futureOverrideCount ?? 0,
        futureExceptionCount: response.futureExceptionCount ?? 0,
      };
    }

    revalidateScheduleViews();

    return {
      scheduleId: input.scheduleId,
      occurrenceKey: input.occurrenceKey,
      mode: 'recurring',
      status: 'scheduled',
      startAt,
      endAt,
      timezone: input.timezone,
      reason: normalizedReason,
    };
  }

  if (!isRecurringSchedule) {
    const startDate = normalizeScheduleFormDate(input.date, input.timezone);
    if (!startDate) {
      throw new Error('Invalid session date.');
    }
    const startAt = toOccurrenceKeyInTimezone(
      input.date,
      input.startTime,
      input.timezone,
    );
    const endAt = toOccurrenceKeyInTimezone(input.date, input.endTime, input.timezone);
    await api.post('/schedules/session/reschedule', {
      orgId: org.id,
      scheduleId: input.scheduleId,
      occurrenceKey: input.occurrenceKey ?? null,
      startAt,
      endAt,
      timezone: input.timezone,
      reason: normalizedReason,
      suppressNotifications: input.suppressNotifications === true,
    });
    revalidateScheduleViews();

    return {
      scheduleId: input.scheduleId,
      occurrenceKey: input.occurrenceKey,
      mode: 'single',
      status: 'scheduled',
      startAt,
      endAt,
      timezone: input.timezone,
      reason: normalizedReason,
    };
  }

  const originalDate =
    getLocalDate(input.occurrenceKey, scheduleTimezone) ??
    input.occurrenceKey.slice(0, 10);
  const restoredToBase =
    originalDate === input.date &&
    targetSchedule.startTime === input.startTime &&
    targetSchedule.endTime === input.endTime;
  const startAt = toOccurrenceKeyInTimezone(
    restoredToBase ? originalDate : input.date,
    restoredToBase ? targetSchedule.startTime : input.startTime,
    scheduleTimezone,
  );
  const endAt = toOccurrenceKeyInTimezone(
    restoredToBase ? originalDate : input.date,
    restoredToBase ? targetSchedule.endTime : input.endTime,
    scheduleTimezone,
  );

  await api.post('/schedules/session/reschedule', {
    orgId: org.id,
    scheduleId: input.scheduleId,
    occurrenceKey: input.occurrenceKey ?? null,
    startAt,
    endAt,
    timezone: scheduleTimezone,
    reason: restoredToBase ? null : normalizedReason,
    suppressNotifications: input.suppressNotifications === true,
  });
  revalidateScheduleViews();

  return {
    scheduleId: input.scheduleId,
    occurrenceKey: input.occurrenceKey,
    mode: 'recurring',
    status: restoredToBase ? 'scheduled' : 'rescheduled',
    startAt,
    endAt,
    timezone: scheduleTimezone,
    reason: restoredToBase ? null : normalizedReason,
  };
}
