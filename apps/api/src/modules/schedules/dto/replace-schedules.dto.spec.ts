import { BadRequestException } from '@nestjs/common';
import { parseReplaceSchedulesDto } from '@iconicedu/api/modules/schedules/dto/replace-schedules.dto';

const basePayload = {
  orgId: 'org-1',
  learningSpaceId: 'space-1',
  channelId: 'channel-1',
  createdBy: 'profile-admin-1',
  title: 'Algebra',
  description: null,
  themeKey: 'teal',
  schedules: [],
};

describe('parseReplaceSchedulesDto', () => {
  it('accepts classroom participant roles for schedule replacement', () => {
    const dto = parseReplaceSchedulesDto({
      ...basePayload,
      participants: [
        { profileId: 'educator-1', kind: 'educator' },
        { profileId: 'child-1', kind: 'child' },
        { profileId: 'guardian-1', kind: 'guardian' },
        { profileId: 'staff-1', kind: 'staff' },
        { profileId: 'observer-1', kind: 'observer' },
      ],
    });

    expect(dto.participants.map((participant) => participant.kind)).toEqual([
      'educator',
      'child',
      'guardian',
      'staff',
      'observer',
    ]);
  });

  it('rejects system profiles as schedule participants', () => {
    expect(() =>
      parseReplaceSchedulesDto({
        ...basePayload,
        participants: [{ profileId: 'system-1', kind: 'system' }],
      }),
    ).toThrow(BadRequestException);
  });

  const VALID_UUID = '00000000-0000-4000-8000-000000000001';
  const OTHER_UUID = '00000000-0000-4000-8000-000000000002';

  it('accepts an optional schedule id and defaults removedScheduleIds to empty', () => {
    const dto = parseReplaceSchedulesDto({
      ...basePayload,
      participants: [],
      schedules: [
        {
          id: VALID_UUID,
          startAt: '2026-09-01T00:00:00.000Z',
          endAt: '2026-09-01T01:00:00.000Z',
          timezone: 'UTC',
        },
        {
          startAt: '2026-09-02T00:00:00.000Z',
          endAt: '2026-09-02T01:00:00.000Z',
          timezone: 'UTC',
        },
      ],
    });

    expect(dto.schedules.map((schedule) => schedule.id)).toEqual([VALID_UUID, null]);
    expect(dto.removedScheduleIds).toEqual([]);
  });

  it('accepts explicit removedScheduleIds', () => {
    const dto = parseReplaceSchedulesDto({
      ...basePayload,
      participants: [],
      removedScheduleIds: [VALID_UUID, OTHER_UUID],
    });

    expect(dto.removedScheduleIds).toEqual([VALID_UUID, OTHER_UUID]);
  });

  it('rejects a malformed schedule id', () => {
    expect(() =>
      parseReplaceSchedulesDto({
        ...basePayload,
        participants: [],
        schedules: [
          {
            id: 'not-a-uuid',
            startAt: '2026-09-01T00:00:00.000Z',
            endAt: '2026-09-01T01:00:00.000Z',
            timezone: 'UTC',
          },
        ],
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects a malformed removedScheduleIds entry', () => {
    expect(() =>
      parseReplaceSchedulesDto({
        ...basePayload,
        participants: [],
        removedScheduleIds: ['not-a-uuid'],
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects duplicate schedule ids', () => {
    expect(() =>
      parseReplaceSchedulesDto({
        ...basePayload,
        participants: [],
        schedules: [
          {
            id: VALID_UUID,
            startAt: '2026-09-01T00:00:00.000Z',
            endAt: '2026-09-01T01:00:00.000Z',
            timezone: 'UTC',
          },
          {
            id: VALID_UUID,
            startAt: '2026-09-02T00:00:00.000Z',
            endAt: '2026-09-02T01:00:00.000Z',
            timezone: 'UTC',
          },
        ],
      }),
    ).toThrow(BadRequestException);
  });
});
