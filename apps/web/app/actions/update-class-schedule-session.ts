'use server';

import { revalidatePath } from 'next/cache';
import type { LearningSpaceCreatePayload, UserProfileVM } from '@iconicedu/shared-types';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { getAccountByAuthUserIdInOrg } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { getLearningSpaceDetail } from '@iconicedu/web/lib/admin/learning-space-detail';
import {
  normalizeScheduleFormDate,
  toOccurrenceKeyInTimezone,
} from '@iconicedu/web/lib/admin/learning-space-schedule-hash';
import { mapSchedulesToPayload } from '@iconicedu/web/lib/admin/learning-space-form-schedules';
import { updateLearningSpaceFromPayload } from '@iconicedu/web/lib/admin/learning-space-update';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { getLocalDate } from '@iconicedu/utils';

export type UpdateClassScheduleSessionActionInput = {
  orgSlug: string;
  scheduleId: string;
  occurrenceKey: string;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  reason?: string | null;
  sendActivityNotifications?: boolean;
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

function normalizeReason(reason?: string | null) {
  const trimmed = reason?.trim();
  return trimmed ? trimmed : null;
}

function mapParticipantsToPayload(selected: UserProfileVM[]) {
  return selected.map((participant) => ({
    profileId: participant.ids.id,
    kind: participant.kind,
    displayName: participant.profile.displayName,
    avatarUrl: participant.profile.avatar.url ?? null,
    themeKey: participant.ui?.themeKey ?? null,
  }));
}

function isValidTimeRange(startTime: string, endTime: string) {
  return Boolean(startTime) && Boolean(endTime) && startTime < endTime;
}

export async function updateClassScheduleSessionAction(
  input: UpdateClassScheduleSessionActionInput,
): Promise<UpdateClassScheduleSessionActionResult> {
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

  const serviceSupabase = createSupabaseServiceClient();
  const { data: scheduleRow, error: scheduleError } = await serviceSupabase
    .from('class_schedules')
    .select(
      'id, org_id, source_learning_space_id, source_channel_id, timezone, title, start_at, end_at',
    )
    .eq('id', input.scheduleId)
    .eq('org_id', org.id)
    .is('deleted_at', null)
    .maybeSingle<{
      id: string;
      org_id: string;
      source_learning_space_id: string | null;
      source_channel_id: string | null;
      timezone: string | null;
      title: string;
      start_at: string;
      end_at: string;
    }>();

  if (scheduleError) {
    throw new Error(scheduleError.message);
  }

  if (!scheduleRow?.source_learning_space_id) {
    throw new Error('Session not found.');
  }

  const detail = await getLearningSpaceDetail(scheduleRow.source_learning_space_id);
  const targetSchedule = detail.schedules.find(
    (schedule) => schedule.id === input.scheduleId,
  );

  if (!targetSchedule) {
    throw new Error('Session not found.');
  }

  const normalizedReason = normalizeReason(input.reason);
  const isRecurringSchedule = Boolean(targetSchedule.rule);
  const scheduleTimezone =
    targetSchedule.timezone || scheduleRow.timezone || input.timezone;
  const updatedSchedules = detail.schedules.map((schedule) => {
    if (schedule.id !== input.scheduleId) {
      return schedule;
    }

    if (!isRecurringSchedule) {
      const startDate = normalizeScheduleFormDate(input.date, input.timezone);
      if (!startDate) {
        throw new Error('Invalid session date.');
      }

      return {
        ...schedule,
        startDate,
        startTime: input.startTime,
        endTime: input.endTime,
        timezone: input.timezone,
      };
    }

    const originalDate =
      getLocalDate(input.occurrenceKey, scheduleTimezone) ??
      input.occurrenceKey.slice(0, 10);
    const shouldUseBaseOccurrence =
      originalDate === input.date &&
      schedule.startTime === input.startTime &&
      schedule.endTime === input.endTime;

    return {
      ...schedule,
      exceptions: schedule.exceptions.filter(
        (exception) => exception.date !== originalDate,
      ),
      overrides: shouldUseBaseOccurrence
        ? schedule.overrides.filter((override) => override.originalDate !== originalDate)
        : [
            ...schedule.overrides.filter(
              (override) => override.originalDate !== originalDate,
            ),
            {
              id:
                schedule.overrides.find(
                  (override) => override.originalDate === originalDate,
                )?.id ?? `${input.scheduleId}:override:${originalDate}`,
              originalDate,
              newDate: input.date,
              newTime: input.startTime,
              newEndTime: input.endTime,
              reason: normalizedReason ?? undefined,
            },
          ],
    };
  });

  const payload: LearningSpaceCreatePayload = {
    basics: {
      title: detail.basics.title,
      kind: detail.basics.kind,
      iconKey: detail.basics.iconKey,
      subject: detail.basics.subject,
      description: detail.basics.description,
    },
    settings: {
      themeKey: detail.settings.themeKey,
      uiDefaults: detail.settings.uiDefaults ?? null,
    },
    liveSession: detail.liveSession,
    participants: mapParticipantsToPayload(detail.participants),
    schedules: mapSchedulesToPayload(updatedSchedules),
  };

  await updateLearningSpaceFromPayload(
    scheduleRow.source_learning_space_id,
    payload,
    {
      orgId: org.id,
      actorProfileId: actorProfile.id,
    },
    {
      sendActivityNotifications: input.sendActivityNotifications ?? true,
    },
  );

  revalidatePath(`/${input.orgSlug}/class-schedule`);
  if (scheduleRow.source_channel_id) {
    revalidatePath(`/${input.orgSlug}/s/${scheduleRow.source_channel_id}`);
  }

  if (!isRecurringSchedule) {
    return {
      scheduleId: input.scheduleId,
      occurrenceKey: input.occurrenceKey,
      mode: 'single',
      status: 'scheduled',
      startAt: toOccurrenceKeyInTimezone(input.date, input.startTime, input.timezone),
      endAt: toOccurrenceKeyInTimezone(input.date, input.endTime, input.timezone),
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

  return {
    scheduleId: input.scheduleId,
    occurrenceKey: input.occurrenceKey,
    mode: 'recurring',
    status: restoredToBase ? 'scheduled' : 'rescheduled',
    startAt: toOccurrenceKeyInTimezone(
      restoredToBase ? originalDate : input.date,
      restoredToBase ? targetSchedule.startTime : input.startTime,
      scheduleTimezone,
    ),
    endAt: toOccurrenceKeyInTimezone(
      restoredToBase ? originalDate : input.date,
      restoredToBase ? targetSchedule.endTime : input.endTime,
      scheduleTimezone,
    ),
    timezone: scheduleTimezone,
    reason: restoredToBase ? null : normalizedReason,
  };
}
