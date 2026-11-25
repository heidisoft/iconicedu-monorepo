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

describe('audience copy edge cases', () => {
  const names = new Map([
    ['me', 'Alex'],
    ['other', 'Taylor'],
  ]);
  const copy = (visibility: Parameters<typeof getVisibilityCopy>[0]) =>
    getVisibilityCopy(visibility, names, 'me');
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
