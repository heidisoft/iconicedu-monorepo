import type { ClassScheduleVM } from '@iconicedu/shared-types';
import type { DisplayClassScheduleVM } from '@iconicedu/ui-web/lib/class-schedule-utils';
import type { CancelClassScheduleSessionActionResult } from '@iconicedu/web/app/actions/cancel-class-schedule-session';

export function getBaseScheduleId(scheduleId: string) {
  const separatorIndex = scheduleId.indexOf('__');
  return separatorIndex === -1 ? scheduleId : scheduleId.slice(0, separatorIndex);
}

export function getEventOccurrenceKey(event: DisplayClassScheduleVM) {
  return event.uiState?.originalStartAt ?? event.startAt;
}

export function applyCancelledSessionToSchedules(
  schedules: ClassScheduleVM[],
  result: CancelClassScheduleSessionActionResult,
): ClassScheduleVM[] {
  return schedules.map((schedule) => {
    if (schedule.ids.id !== result.scheduleId) {
      return schedule;
    }

    if (result.mode === 'single') {
      return {
        ...schedule,
        status: 'cancelled' as const,
      };
    }

    const nextExceptions = [
      ...(schedule.recurrence?.exceptions ?? []).filter(
        (exception) => exception.occurrenceKey !== result.occurrenceKey,
      ),
      {
        occurrenceKey: result.occurrenceKey,
        reason: result.reason ?? undefined,
      },
    ];

    const nextOverrides = (schedule.recurrence?.overrides ?? []).filter(
      (override) => override.occurrenceKey !== result.occurrenceKey,
    );

    return {
      ...schedule,
      recurrence: schedule.recurrence
        ? {
            ...schedule.recurrence,
            exceptions: nextExceptions,
            overrides: nextOverrides.length ? nextOverrides : undefined,
          }
        : schedule.recurrence,
    };
  });
}
