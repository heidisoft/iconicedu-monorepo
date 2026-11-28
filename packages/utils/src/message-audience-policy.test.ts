import { describe, expect, it } from 'vitest';
import {
  canAddressPrivately,
  canInitiateRestrictedMessage,
  isOutsideMessageAudience,
  requiresGuardianForStudentRecipients,
  resolveMessageAudienceRole,
  type MessageAudienceRole,
} from './message-audience-policy';

describe('resolveMessageAudienceRole', () => {
  it.each([
    ['staff', {}, 'staff'],
    ['educator', {}, 'tutor'],
    ['guardian', {}, 'parent'],
    ['child', {}, 'student'],
    ['system', {}, 'other'],
    [null, {}, 'other'],
    ['educator', { hasStaffRole: true }, 'staff'],
    ['guardian', { hasStaffRole: true }, 'staff'],
  ] as const)('maps %s %o to %s', (kind, options, expected) => {
    expect(resolveMessageAudienceRole(kind, options)).toBe(expected);
  });
});

describe('canAddressPrivately', () => {
  const roles: MessageAudienceRole[] = ['staff', 'tutor', 'parent', 'student', 'other'];
  const allowed: Record<MessageAudienceRole, MessageAudienceRole[]> = {
    staff: ['staff', 'tutor', 'parent', 'student', 'other'],
    tutor: ['staff', 'tutor', 'parent', 'student'],
    parent: ['staff', 'tutor'],
    student: [],
    other: [],
  };

  for (const sender of roles) {
    for (const recipient of roles) {
      const expected = allowed[sender].includes(recipient);
      it(`${sender} -> ${recipient}: ${expected ? 'allowed' : 'blocked'}`, () => {
        expect(canAddressPrivately(sender, recipient)).toBe(expected);
      });
    }
  }

  it('lets only staff, tutors, and parents start private messages', () => {
    expect(roles.filter(canInitiateRestrictedMessage)).toEqual([
      'staff',
      'tutor',
      'parent',
    ]);
  });

  it('requires a guardian alongside students for everyone except staff', () => {
    expect(requiresGuardianForStudentRecipients('staff')).toBe(false);
    expect(requiresGuardianForStudentRecipients('tutor')).toBe(true);
  });
});

describe('isOutsideMessageAudience', () => {
  const restricted = { type: 'specific-users' as const, userIds: ['sender', 'parent'] };

  it('is false for everyone messages and unknown viewers', () => {
    expect(
      isOutsideMessageAudience({ visibility: { type: 'all' }, viewerProfileId: 'staff' }),
    ).toBe(false);
    expect(isOutsideMessageAudience({ visibility: restricted })).toBe(false);
  });

  it('is false for the sender and audience members', () => {
    expect(
      isOutsideMessageAudience({
        visibility: restricted,
        senderProfileId: 'sender',
        viewerProfileId: 'sender',
      }),
    ).toBe(false);
    expect(
      isOutsideMessageAudience({ visibility: restricted, viewerProfileId: 'parent' }),
    ).toBe(false);
  });

  it('is true for staff reviewing a message they are not part of', () => {
    expect(
      isOutsideMessageAudience({
        visibility: restricted,
        senderProfileId: 'sender',
        viewerProfileId: 'staff',
      }),
    ).toBe(true);
    expect(
      isOutsideMessageAudience({
        visibility: { type: 'recipient-only', userId: 'parent' },
        senderProfileId: 'sender',
        viewerProfileId: 'staff',
      }),
    ).toBe(true);
    expect(
      isOutsideMessageAudience({
        visibility: { type: 'sender-only' },
        senderProfileId: 'sender',
        viewerProfileId: 'staff',
      }),
    ).toBe(true);
  });
});
