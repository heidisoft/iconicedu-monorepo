import type { ClassScheduleVM } from '@iconicedu/shared-types';

jest.mock('@iconicedu/api/lib/schedules/class-schedule.builder', () => ({
  buildClassSchedulesByOrg: jest.fn(),
  buildClassSchedulesByIds: jest.fn(),
}));

import { buildClassSchedulesByIds } from '@iconicedu/api/lib/schedules/class-schedule.builder';
import { resolveClassSessionOccurrenceScope } from '@iconicedu/api/lib/live-sessions/scope';

const ORG_ID = 'org-1';
const SCHEDULE_ID = 'schedule-1';
const CHANNEL_ID = 'channel-1';

function buildWeeklySchedule(overrides?: Partial<ClassScheduleVM>): ClassScheduleVM {
  return {
    ids: { id: SCHEDULE_ID, orgId: ORG_ID },
    title: 'Algebra',
    description: null,
    location: null,
    meetingLink: null,
    startAt: '2026-04-03T10:00:00.000Z',
    endAt: '2026-04-03T11:00:00.000Z',
    timezone: 'UTC',
    status: 'scheduled',
    visibility: 'participants',
    themeKey: null,
    participants: [],
    source: {
      kind: 'class_session',
      learningSpaceId: 'space-1',
      channelId: CHANNEL_ID,
    },
    recurrence: {
      ids: { id: 'recurrence-1', orgId: ORG_ID },
      rule: { frequency: 'weekly', interval: 1, byWeekday: ['FR'], timezone: 'UTC' },
    },
    audit: { createdAt: '2026-01-01T00:00:00.000Z', createdBy: 'profile-1' },
    ...overrides,
  } as ClassScheduleVM;
}

function mockSchedule(schedule: ClassScheduleVM | null) {
  jest.mocked(buildClassSchedulesByIds).mockResolvedValue(schedule ? [schedule] : []);
}

function resolve(occurrenceKey: string) {
  return resolveClassSessionOccurrenceScope({
    supabase: {} as never,
    orgId: ORG_ID,
    scheduleId: SCHEDULE_ID,
    occurrenceKey,
  });
}

describe('resolveClassSessionOccurrenceScope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves a future recurring occurrence without consulting the clock', async () => {
    mockSchedule(buildWeeklySchedule());

    const resolved = await resolve('2026-05-01T10:00:00.000Z');

    expect(resolved).not.toBeNull();
    expect(resolved?.occurrenceKey).toBe('2026-05-01T10:00:00.000Z');
    expect(resolved?.channelId).toBe(CHANNEL_ID);
    expect(resolved?.scope.scopeKey).toBe('occurrence:2026-05-01T10:00:00.000Z');
    expect(resolved?.isCancelled).toBe(false);
  });

  it('keeps two occurrences of the same channel in distinct scopes', async () => {
    mockSchedule(buildWeeklySchedule());
    const first = await resolve('2026-05-01T10:00:00.000Z');

    mockSchedule(buildWeeklySchedule());
    const second = await resolve('2026-05-08T10:00:00.000Z');

    expect(first?.scope.scopeKey).not.toBe(second?.scope.scopeKey);
  });

  it('keeps the original occurrence key for a rescheduled occurrence', async () => {
    mockSchedule(
      buildWeeklySchedule({
        recurrence: {
          ids: { id: 'recurrence-1', orgId: ORG_ID },
          rule: { frequency: 'weekly', interval: 1, byWeekday: ['FR'], timezone: 'UTC' },
          overrides: [
            {
              occurrenceKey: '2026-05-01T10:00:00.000Z',
              patch: {
                startAt: '2026-05-01T14:00:00.000Z',
                endAt: '2026-05-01T15:00:00.000Z',
              },
            },
          ],
        },
      } as Partial<ClassScheduleVM>),
    );

    const resolved = await resolve('2026-05-01T10:00:00.000Z');

    expect(resolved?.occurrenceKey).toBe('2026-05-01T10:00:00.000Z');
    expect(resolved?.effectiveStartAt).toBe('2026-05-01T14:00:00.000Z');
    // A room created before the identity change was keyed by the moved start, so
    // both keys are checked to keep repeat joins idempotent.
    expect(resolved?.compatibleScopeKeys).toEqual([
      'occurrence:2026-05-01T10:00:00.000Z',
      'occurrence:2026-05-01T14:00:00.000Z',
    ]);
  });

  it('marks a cancelled exception occurrence as cancelled', async () => {
    mockSchedule(
      buildWeeklySchedule({
        recurrence: {
          ids: { id: 'recurrence-1', orgId: ORG_ID },
          rule: { frequency: 'weekly', interval: 1, byWeekday: ['FR'], timezone: 'UTC' },
          exceptions: [
            { occurrenceKey: '2026-05-01T10:00:00.000Z', reason: 'Public holiday' },
          ],
        },
      } as Partial<ClassScheduleVM>),
    );

    const resolved = await resolve('2026-05-01T10:00:00.000Z');

    expect(resolved?.isCancelled).toBe(true);
  });

  it('returns null for an occurrence key the schedule never produces', async () => {
    mockSchedule(buildWeeklySchedule());

    // A Wednesday against a Friday series — a guessed or tampered key.
    expect(await resolve('2026-04-29T10:00:00.000Z')).toBeNull();
  });

  it('returns null for a malformed occurrence key', async () => {
    mockSchedule(buildWeeklySchedule());

    expect(await resolve('not-a-date')).toBeNull();
  });

  it('returns null when the schedule is not a class session', async () => {
    mockSchedule(
      buildWeeklySchedule({
        source: { kind: 'manual', createdByUserId: 'user-1' },
      } as Partial<ClassScheduleVM>),
    );

    expect(await resolve('2026-05-01T10:00:00.000Z')).toBeNull();
  });

  it('returns null when the schedule belongs to no channel', async () => {
    mockSchedule(
      buildWeeklySchedule({
        source: { kind: 'class_session', learningSpaceId: 'space-1' },
      } as Partial<ClassScheduleVM>),
    );

    expect(await resolve('2026-05-01T10:00:00.000Z')).toBeNull();
  });

  it('returns null when the schedule is not visible to the caller', async () => {
    mockSchedule(null);

    expect(await resolve('2026-05-01T10:00:00.000Z')).toBeNull();
  });
});
