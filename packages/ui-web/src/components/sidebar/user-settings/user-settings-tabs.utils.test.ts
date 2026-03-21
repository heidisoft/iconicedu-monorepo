/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';

import {
  dedupeChildMembersByEmail,
  filterInvitesWithExistingAccounts,
  formatChildName,
  shouldDisableAccountTabInChildView,
} from './user-settings-tabs.utils';

describe('dedupeChildMembersByEmail', () => {
  it('keeps unique child emails and leaves non-child rows', () => {
    const input = [
      { id: 'self', isChild: false, email: 'guardian@example.com' },
      { id: 'c1', isChild: true, email: 'child@example.com' },
      { id: 'c2', isChild: true, email: 'CHILD@example.com' },
      { id: 'c3', isChild: true, email: 'other@example.com' },
    ] as any[];

    const result = dedupeChildMembersByEmail(input);

    expect(result.map((item) => item.id)).toEqual(['self', 'c1', 'c3']);
  });
});

describe('filterInvitesWithExistingAccounts', () => {
  it('removes invites for child emails that already have auth accounts', () => {
    const invites = [
      { id: 'i1', invitedEmail: 'child@example.com' },
      { id: 'i2', invitedEmail: 'new@example.com' },
    ] as any[];
    const members = [
      { isChild: true, hasAuthAccount: false, email: 'CHILD@example.com' },
      { isChild: true, hasAuthAccount: false, email: 'another@example.com' },
    ] as any[];

    const result = filterInvitesWithExistingAccounts(invites, members);

    expect(result.map((item) => item.id)).toEqual(['i2']);
  });
});

describe('formatChildName', () => {
  it('returns first name with last initial only', () => {
    expect(formatChildName('Maya', 'Johnson', 'Maya Johnson')).toBe('Maya J');
  });

  it('falls back when first name is missing', () => {
    expect(formatChildName('', 'Johnson', 'Child Name')).toBe('Child Name');
  });
});

describe('shouldDisableAccountTabInChildView', () => {
  it('disables account tab for child view when child has no auth account', () => {
    expect(
      shouldDisableAccountTabInChildView({
        isViewingAsChild: true,
        isChildProfile: true,
        childHasAuthAccount: false,
      }),
    ).toBe(true);
  });

  it('keeps account tab enabled for child view when child has an auth account', () => {
    expect(
      shouldDisableAccountTabInChildView({
        isViewingAsChild: true,
        isChildProfile: true,
        childHasAuthAccount: true,
      }),
    ).toBe(false);
  });

  it('keeps account tab enabled outside child view', () => {
    expect(
      shouldDisableAccountTabInChildView({
        isViewingAsChild: false,
        isChildProfile: true,
        childHasAuthAccount: false,
      }),
    ).toBe(false);
  });
});
