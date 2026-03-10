/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';

import { isStaffObserverReadOnlyChannel } from '@iconicedu/web/lib/channels/read-only';

describe('isStaffObserverReadOnlyChannel', () => {
  const baseChannel = {
    collections: {
      participants: [
        { ids: { accountId: 'account-1' } },
        { ids: { accountId: 'account-2' } },
      ],
    },
  } as any;

  it('returns true for staff who are not participants', () => {
    expect(
      isStaffObserverReadOnlyChannel(baseChannel, 'account-staff', {
        kind: 'staff',
      } as any),
    ).toBe(true);
  });

  it('returns false for staff who are participants', () => {
    expect(
      isStaffObserverReadOnlyChannel(baseChannel, 'account-1', {
        kind: 'staff',
      } as any),
    ).toBe(false);
  });

  it('returns false for non-staff', () => {
    expect(
      isStaffObserverReadOnlyChannel(baseChannel, 'account-staff', {
        kind: 'educator',
      } as any),
    ).toBe(false);
  });
});
