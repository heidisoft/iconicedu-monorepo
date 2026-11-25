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

describe('audience copy edge cases', () => {
  const names = new Map([
    ['me', 'Alex'],
    ['other', 'Taylor'],
  ]);
  const copy = (
    visibility: Parameters<typeof getMessageVisibilityCopy>[0]['visibility'],
  ) =>
    getMessageVisibilityCopy({
      visibility,
      currentProfileId: 'me',
      participants: [...names].map(([id, name]) => ({ id, name, role: null })),
    });
  it('does not show a private badge for everyone', () => {
    expect(copy({ type: 'all' })).toBeNull();
  });
  it('handles sender-only and recipient-only messages', () => {
    expect(copy({ type: 'sender-only' })?.summary).toBe('Only visible to you');
    expect(copy({ type: 'recipient-only', userId: 'me' })?.summary).toBe(
      'Only visible to you',
    );
    expect(copy({ type: 'recipient-only', userId: 'other' })?.summary).toBe(
      'Only visible to Taylor',
    );
  });
  it('deduplicates people and uses singular other', () => {
    expect(
      copy({ type: 'specific-users', userIds: ['me', 'other', 'other'] })?.summary,
    ).toBe('Only visible to you + 1 other');
    expect(copy({ type: 'specific-users', userIds: ['me'] })?.summary).toBe(
      'Only visible to you',
    );
  });
  it('does not expose profile identifiers for unknown members', () => {
    const value = copy({ type: 'specific-users', userIds: ['unknown-id'] });
    expect(JSON.stringify(value)).not.toContain('unknown-id');
    expect(value?.summary).toBe('Only visible to Channel member');
  });
});
