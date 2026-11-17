import { classroomCallWindow } from './classroom-call-window';
import type { ResolvedLiveSessionScope } from '@iconicedu/live-sessions-core';
const start = '2026-11-03T15:00:00.000Z',
  end = '2026-11-03T16:00:00.000Z';
const session = { occurrence_key: start, app_metadata: { scheduleId: 'schedule' } };
const scope = {
  schedule: { ids: { id: 'schedule' } },
  occurrenceKey: start,
  occurrenceEndAt: end,
} as ResolvedLiveSessionScope;
it.each([
  [Date.parse(start) - 1, false],
  [Date.parse(start), true],
  [Date.parse(end) - 1, true],
  [Date.parse(end), false],
])('strict calling boundary at %s', (now, allowed) => {
  expect(!!classroomCallWindow(session, scope, now)).toBe(allowed);
});
it('rejects ad-hoc, rescheduled, invalid and stale occurrences', () => {
  const now = Date.parse(start) + 1;
  expect(classroomCallWindow({ occurrence_key: null }, scope, now)).toBeNull();
  expect(classroomCallWindow(session, { ...scope, schedule: null }, now)).toBeNull();
  expect(classroomCallWindow(session, { ...scope, occurrenceKey: end }, now)).toBeNull();
  expect(
    classroomCallWindow(
      { ...session, app_metadata: { scheduleId: 'other' } },
      scope,
      now,
    ),
  ).toBeNull();
  expect(
    classroomCallWindow(session, { ...scope, occurrenceEndAt: 'invalid' }, now),
  ).toBeNull();
});
