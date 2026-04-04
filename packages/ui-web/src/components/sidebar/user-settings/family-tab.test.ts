import { describe, expect, it } from 'vitest';

import {
  buildChildDisplayName,
  buildChildInviteDraft,
  buildCollapsedChildSectionState,
  resolveFamilyInviteErrorMessage,
} from './family-tab';

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
    expect(buildChildInviteDraft(' iconicedudev+child@gmail.com ')).toEqual({
      role: 'child',
      email: 'iconicedudev+child@gmail.com',
    });
  });

  it('returns empty email when missing', () => {
    expect(buildChildInviteDraft()).toEqual({
      role: 'child',
      email: '',
    });
  });
});

describe('buildChildDisplayName', () => {
  it('returns first name with last initial only', () => {
    expect(buildChildDisplayName('Maya', 'Johnson')).toBe('Maya J');
  });

  it('omits last initial when last name is missing', () => {
    expect(buildChildDisplayName('Maya', '')).toBe('Maya');
  });
});

describe('resolveFamilyInviteErrorMessage', () => {
  it('returns guidance for already-registered email errors', () => {
    expect(
      resolveFamilyInviteErrorMessage(
        new Error('A user with this email address has already been registered'),
      ),
    ).toContain('already has an account');
  });

  it('returns raw error message when available', () => {
    expect(resolveFamilyInviteErrorMessage(new Error('Custom error'))).toBe(
      'Custom error',
    );
  });

  it('returns fallback for unknown errors', () => {
    expect(resolveFamilyInviteErrorMessage(null)).toBe(
      'Unable to send invite right now. Please try again.',
    );
  });
});
