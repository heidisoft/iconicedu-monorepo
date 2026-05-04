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
});
