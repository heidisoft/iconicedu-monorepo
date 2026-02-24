import { describe, expect, it } from 'vitest';
import { getMemberRowActionKind } from './messages-members-tab';

describe('messages-members-tab', () => {
  it('returns self when row member matches current user', () => {
    expect(getMemberRowActionKind('user-1', 'user-1')).toBe('self');
  });

  it('returns message for other users when current user is known', () => {
    expect(getMemberRowActionKind('user-2', 'user-1')).toBe('message');
  });

  it('returns none when current user is missing', () => {
    expect(getMemberRowActionKind('user-2', null)).toBe('none');
  });
});
