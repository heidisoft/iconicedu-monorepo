import { describe, expect, it } from 'vitest';

import { buildChildInviteDraft, buildCollapsedChildSectionState } from './family-tab';

describe('buildCollapsedChildSectionState', () => {
  it('keeps previously tracked sections and closes the created child section', () => {
    const previous = {
      'child-a': true,
      'child-b': false,
    };

    const next = buildCollapsedChildSectionState(previous, 'child-c');

    expect(next).toEqual({
      'child-a': true,
      'child-b': false,
      'child-c': false,
    });
  });
});

describe('buildChildInviteDraft', () => {
  it('returns child role with trimmed email', () => {
    expect(buildChildInviteDraft(' child@example.com ')).toEqual({
      role: 'child',
      email: 'child@example.com',
    });
  });

  it('returns empty email when missing', () => {
    expect(buildChildInviteDraft()).toEqual({
      role: 'child',
      email: '',
    });
  });
});
