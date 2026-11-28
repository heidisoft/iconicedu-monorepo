import { describe, expect, it } from 'vitest';
import type { MessageVM } from '@iconicedu/shared-types';
import { isHiddenStaffReviewMessage } from './staff-review.utils';

const message = (visibility: MessageVM['core']['visibility']) =>
  ({ core: { visibility, sender: { ids: { id: 'tutor-1' } } } }) as unknown as MessageVM;
const privateMessage = message({
  type: 'specific-users',
  userIds: ['tutor-1', 'parent-1'],
});
const classroom = { basics: { kind: 'channel', purpose: 'learning-space' } } as never;

describe('isHiddenStaffReviewMessage', () => {
  it('hides private messages from viewers outside the audience while flagged off', () => {
    expect(
      isHiddenStaffReviewMessage({
        message: privateMessage,
        channel: classroom,
        viewerProfileId: 'staff-1',
        enableStaffMessageReview: false,
      }),
    ).toBe(true);
  });

  it('shows them once staff review is enabled', () => {
    expect(
      isHiddenStaffReviewMessage({
        message: privateMessage,
        channel: classroom,
        viewerProfileId: 'staff-1',
        enableStaffMessageReview: true,
      }),
    ).toBe(false);
  });

  it.each([
    ['the sender', 'tutor-1'],
    ['an audience member', 'parent-1'],
    ['an unknown viewer', null],
  ])('never hides them from %s', (_label, viewerProfileId) => {
    expect(
      isHiddenStaffReviewMessage({
        message: privateMessage,
        channel: classroom,
        viewerProfileId,
        enableStaffMessageReview: false,
      }),
    ).toBe(false);
  });

  it('never hides everyone messages', () => {
    expect(
      isHiddenStaffReviewMessage({
        message: message({ type: 'all' }),
        channel: classroom,
        viewerProfileId: 'staff-1',
        enableStaffMessageReview: false,
      }),
    ).toBe(false);
  });

  it.each([
    ['support channels', { basics: { kind: 'channel', purpose: 'support' } }],
    ['direct messages', { basics: { kind: 'dm', purpose: 'general' } }],
  ])('leaves %s to their own audience model', (_label, channel) => {
    expect(
      isHiddenStaffReviewMessage({
        message: privateMessage,
        channel: channel as never,
        viewerProfileId: 'staff-1',
        enableStaffMessageReview: false,
      }),
    ).toBe(false);
  });
});
