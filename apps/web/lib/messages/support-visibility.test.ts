import { describe, expect, it } from 'vitest';

import { buildSupportVisibilityFields } from './support-visibility';

describe('buildSupportVisibilityFields', () => {
  it('returns all visibility for non-support channels', () => {
    expect(
      buildSupportVisibilityFields({
        isSupportChannel: false,
        isStaffSender: false,
        isThreadReply: false,
        currentProfileId: 'profile-1',
      }),
    ).toEqual({ visibility_type: 'all' });
  });

  it('returns specific-users visibility for support top-level question', () => {
    expect(
      buildSupportVisibilityFields({
        isSupportChannel: true,
        isStaffSender: false,
        isThreadReply: false,
        currentProfileId: 'profile-1',
      }),
    ).toEqual({
      visibility_type: 'specific-users',
      visibility_user_ids: ['profile-1'],
    });
  });

  it('throws for staff top-level support posts', () => {
    expect(() =>
      buildSupportVisibilityFields({
        isSupportChannel: true,
        isStaffSender: true,
        isThreadReply: false,
        currentProfileId: 'profile-staff',
      }),
    ).toThrow('Support staff must reply in a thread');
  });
});
