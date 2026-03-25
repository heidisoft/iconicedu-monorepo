import type { ParticipantRoleVM } from '@iconicedu/shared-types';

import { __test__ } from './use-upcoming-sessions';

function makeSchedule(input: {
  participantId: string;
  participantRole: ParticipantRoleVM;
}) {
  return {
    source: { kind: 'class_session' as const },
    participants: [
      {
        ids: { id: input.participantId, orgId: 'org-1' },
        role: input.participantRole,
      },
    ],
  };
}

describe('useUpcomingSessions scoping helpers', () => {
  it('scopes guardian mode to linked child profile ids', () => {
    const scopedProfileIds = __test__.getScopedProfileIds({
      profileKind: 'guardian',
      profileId: 'guardian-1',
      childProfileIds: ['child-1', 'child-2'],
    });

    expect(
      __test__.isScopedSchedule({
        schedule: makeSchedule({
          participantId: 'child-1',
          participantRole: 'child',
        }),
        profileKind: 'guardian',
        scopedProfileIds,
      }),
    ).toBe(true);

    expect(
      __test__.isScopedSchedule({
        schedule: makeSchedule({
          participantId: 'other-child',
          participantRole: 'child',
        }),
        profileKind: 'guardian',
        scopedProfileIds,
      }),
    ).toBe(false);
  });

  it('scopes child mode to only the effective child profile id', () => {
    const scopedProfileIds = __test__.getScopedProfileIds({
      profileKind: 'child',
      profileId: 'child-2',
    });

    expect(
      __test__.isScopedSchedule({
        schedule: makeSchedule({
          participantId: 'child-2',
          participantRole: 'child',
        }),
        profileKind: 'child',
        scopedProfileIds,
      }),
    ).toBe(true);

    expect(
      __test__.isScopedSchedule({
        schedule: makeSchedule({
          participantId: 'child-1',
          participantRole: 'child',
        }),
        profileKind: 'child',
        scopedProfileIds,
      }),
    ).toBe(false);
  });
});
