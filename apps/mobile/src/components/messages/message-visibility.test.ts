import { getMessageVisibilityCopy } from './message-visibility';

describe('getMessageVisibilityCopy', () => {
  const participants = [
    { id: 'profile-me', name: 'Alex', role: 'guardian' },
    { id: 'profile-1', name: 'Marc F', role: 'staff' },
    { id: 'profile-2', name: 'Taylor R', role: 'educator' },
  ];

  it('summarizes the audience relative to the current viewer', () => {
    expect(
      getMessageVisibilityCopy({
        visibility: {
          type: 'specific-users',
          userIds: ['profile-me', 'profile-1', 'profile-2'],
        },
        currentProfileId: 'profile-me',
        participants,
      }),
    ).toEqual({
      summary: 'Only visible to you + 2 others',
      audienceNames: ['You', 'Marc F', 'Taylor R'],
    });
  });

  it('uses a compact named summary when the current profile is unavailable', () => {
    expect(
      getMessageVisibilityCopy({
        visibility: { type: 'specific-users', userIds: ['profile-1', 'profile-2'] },
        participants,
      }),
    ).toEqual({
      summary: 'Only visible to Marc F + 1 other',
      audienceNames: ['Marc F', 'Taylor R'],
    });
  });
});
