'use server';

import { revalidatePath } from 'next/cache';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { getAccountByAuthUserIdInOrg } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { getLearningSpaceDetail } from '@iconicedu/web/lib/admin/learning-space-detail';
import {
  toOccurrenceKeyInTimezone,
  weekdayTokenFromLocalDate,
} from '@iconicedu/web/lib/admin/learning-space-schedule-hash';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';
import { getClassScheduleSessionContext } from '@iconicedu/web/lib/api/schedules';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { enableClassScheduleSeriesReschedule } from '@iconicedu/web/flags';

/** "This and following events": splits the recurring series at the edited
 * occurrence — everything before it keeps the old day/time (and its history,
 * including completion records, stays attached to the same schedule id);
 * everything from this occurrence forward moves to a new series on the day
 * derived from `date`. See SchedulesService.splitRecurringSeries. */
export type SplitClassScheduleSessionActionInput = {
  orgSlug: string;
  scheduleId: string;
  occurrenceKey: string;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  reason?: string | null;
  suppressNotifications?: boolean;
  /** Confirms dropping future exceptions/overrides on the old pattern that
   * won't carry forward to the new series — see the requiresConfirmation
   * outcome below. */
  confirmDropFutureOverrides?: boolean;
};

export type SplitClassScheduleSessionActionResult = {
  oldScheduleId: string;
  newScheduleId: string;
};

export type SplitClassScheduleSessionActionOutcome =
  | SplitClassScheduleSessionActionResult
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

export async function splitClassScheduleSessionAction(
  input: SplitClassScheduleSessionActionInput,
): Promise<SplitClassScheduleSessionActionOutcome> {
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
  if (!profileResponse.data) {
    throw new Error('Profile record not found');
  }

  const seriesRescheduleEnabled = await enableClassScheduleSeriesReschedule.run({
    identify: { profileId: profileResponse.data.id },
  });
  if (!seriesRescheduleEnabled) {
    throw new Error('This feature is not available yet.');
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
  if (!targetSchedule?.rule) {
    throw new Error('This session is not part of a recurring series.');
  }

  const scheduleTimezone =
    targetSchedule.timezone || sessionContext.timezone || input.timezone;
  const newStartAt = toOccurrenceKeyInTimezone(
    input.date,
    input.startTime,
    input.timezone,
  );
  const newEndAt = toOccurrenceKeyInTimezone(input.date, input.endTime, input.timezone);
  const normalizedReason = normalizeReason(input.reason);

  const api = createApiClient(supabase);
  const response = await api.post<{
    success?: true;
    oldScheduleId?: string;
    newScheduleId?: string;
    requiresConfirmation?: true;
    futureOverrideCount?: number;
    futureExceptionCount?: number;
  }>('/schedules/session/split', {
    orgId: org.id,
    scheduleId: input.scheduleId,
    occurrenceKey: input.occurrenceKey,
    newStartAt,
    newEndAt,
    timezone: input.timezone ?? scheduleTimezone,
    byWeekday: [weekdayTokenFromLocalDate(input.date)],
    reason: normalizedReason,
    suppressNotifications: input.suppressNotifications === true,
    confirmDropFutureOverrides: input.confirmDropFutureOverrides === true,
  });

  if (response.requiresConfirmation) {
    return {
      requiresConfirmation: true,
      futureOverrideCount: response.futureOverrideCount ?? 0,
      futureExceptionCount: response.futureExceptionCount ?? 0,
    };
  }

  revalidatePath(`/${input.orgSlug}/class-schedule`);
  if (sessionContext.sourceChannelId) {
    revalidatePath(`/${input.orgSlug}/s/${sessionContext.sourceChannelId}`);
  }

  return {
    oldScheduleId: response.oldScheduleId!,
    newScheduleId: response.newScheduleId!,
  };
}
