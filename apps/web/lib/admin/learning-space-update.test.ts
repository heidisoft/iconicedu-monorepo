import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createSupabaseServiceClientMock, insertClassSchedulesMock } = vi.hoisted(() => ({
  createSupabaseServiceClientMock: vi.fn(),
  insertClassSchedulesMock: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: createSupabaseServiceClientMock,
}));

vi.mock('@iconicedu/web/lib/admin/learning-space-create', async () => {
  const actual = await vi.importActual<
    typeof import('@iconicedu/web/lib/admin/learning-space-create')
  >('@iconicedu/web/lib/admin/learning-space-create');

  return {
    ...actual,
    insertClassSchedules: insertClassSchedulesMock,
  };
});

import { replaceLearningSpaceSchedules } from '@iconicedu/web/lib/admin/learning-space-update';

function createSelectChain(result: { data: unknown; error: { message: string } | null }) {
  const chain = {
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    is: vi.fn(async () => result),
  };

  return {
    select: vi.fn(() => chain),
  };
}

function createDeleteChain() {
  const chain = {
    eq: vi.fn(() => chain),
    in: vi.fn(async () => ({ error: null })),
    delete: vi.fn(() => chain),
  };

  return chain;
}

function createTableWithSelectAndDelete(result: {
  data: unknown;
  error: { message: string } | null;
}) {
  return {
    ...createSelectChain(result),
    ...createDeleteChain(),
  };
}

describe('replaceLearningSpaceSchedules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('replaces schedules using the service client', async () => {
    const classSchedulesTable = createTableWithSelectAndDelete({
      data: [{ id: 'schedule-1' }],
      error: null,
    });
    const recurrenceTable = createTableWithSelectAndDelete({
      data: [{ id: 'recurrence-1' }],
      error: null,
    });
    const recurrenceExceptionsDelete = createDeleteChain();
    const recurrenceOverridesDelete = createDeleteChain();
    const scheduleParticipantsDelete = createDeleteChain();

    const serviceClient = {
      from: vi.fn((table: string) => {
        switch (table) {
          case 'class_schedules':
            return classSchedulesTable;
          case 'class_schedule_recurrence':
            return recurrenceTable;
          case 'class_schedule_recurrence_exceptions':
            return recurrenceExceptionsDelete;
          case 'class_schedule_recurrence_overrides':
            return recurrenceOverridesDelete;
          case 'class_schedule_participants':
            return scheduleParticipantsDelete;
          default:
            throw new Error(`Unexpected table ${table}`);
        }
      }),
    };

    createSupabaseServiceClientMock.mockReturnValue(serviceClient);
    insertClassSchedulesMock.mockResolvedValue(['schedule-2']);

    await replaceLearningSpaceSchedules({} as never, {
      orgId: 'org-1',
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
      createdBy: 'profile-1',
      createdAt: '2026-03-01T00:00:00.000Z',
      title: 'Algebra',
      description: 'Updated schedule',
      themeKey: 'teal',
      participants: [],
      schedules: [
        {
          startDate: '2026-03-10T14:00:00.000Z',
          timezone: 'UTC',
          rule: {
            frequency: 'weekly',
            byWeekday: ['TU'],
            weekdayTimes: [{ day: 'TU', time: '14:00' }],
          },
          exceptions: [],
          overrides: [],
        },
      ],
    });

    expect(createSupabaseServiceClientMock).toHaveBeenCalledTimes(1);
    expect(insertClassSchedulesMock).toHaveBeenCalledWith(
      serviceClient,
      expect.objectContaining({
        orgId: 'org-1',
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
        title: 'Algebra',
      }),
    );
    expect(classSchedulesTable.delete).toHaveBeenCalledTimes(1);
    expect(recurrenceTable.delete).toHaveBeenCalledTimes(1);
  });
});
