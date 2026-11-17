import { getVisibilityCopy } from './visibility-badge';

describe('getVisibilityCopy', () => {
  const names = new Map([
    ['profile-me', 'Alex'],
    ['profile-1', 'Marc F'],
  ]);

  it('summarizes selected people relative to the viewer', () => {
    expect(
      getVisibilityCopy(
        {
          type: 'specific-users',
          userIds: ['profile-me', 'profile-1'],
        },
        names,
        'profile-me',
      ),
    ).toEqual({
      summary: 'Only visible to you + 1 other',
      names: ['You', 'Marc F'],
    });
  });
});
