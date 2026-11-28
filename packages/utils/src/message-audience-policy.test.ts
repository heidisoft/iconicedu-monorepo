import { describe, expect, it } from 'vitest';
import {
  canAddressPrivately,
  canInitiateRestrictedMessage,
  getMessageAudienceGroupOptions,
  groupMessageAudienceCandidates,
  isExactAudienceSelection,
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

describe('groupMessageAudienceCandidates', () => {
  const members = [
    { id: 'owner', kind: 'staff' },
    { id: 'staff-2', kind: 'staff' },
    { id: 'tutor', kind: 'educator' },
    { id: 'parent-a', kind: 'guardian' },
    { id: 'parent-b', kind: 'guardian' },
    { id: 'student', kind: 'child' },
    { id: 'unknown', kind: null },
  ];

  it('offers staff as one group and names everyone else for a tutor', () => {
    const groups = groupMessageAudienceCandidates(members, { senderId: 'tutor' });
    expect(groups.staffIds).toEqual(['owner', 'staff-2']);
    expect(groups.parents.map((p) => p.id)).toEqual(['parent-a', 'parent-b']);
    expect(groups.tutors).toEqual([]);
    expect(groups.students.map((p) => p.id)).toEqual(['student']);
    expect(groups.namedPeople.map((p) => p.id)).toEqual([
      'parent-a',
      'parent-b',
      'student',
    ]);
  });

  it('lets a parent reach staff and tutors only', () => {
    const groups = groupMessageAudienceCandidates(members, { senderId: 'parent-a' });
    expect(groups.staffIds).toEqual(['owner', 'staff-2']);
    expect(groups.namedPeople.map((p) => p.id)).toEqual(['tutor']);
  });

  it('excludes the sending staff member from the staff group', () => {
    const groups = groupMessageAudienceCandidates(members, { senderId: 'owner' });
    expect(groups.staffIds).toEqual(['staff-2']);
    expect(groups.namedPeople.map((p) => p.id)).toEqual([
      'parent-a',
      'parent-b',
      'tutor',
      'student',
      'unknown',
    ]);
  });

  it("uses the sender's own kind when they are not a member", () => {
    const groups = groupMessageAudienceCandidates(members, {
      senderId: 'observer',
      senderKind: 'staff',
    });
    expect(groups.staffIds).toEqual(['owner', 'staff-2']);
  });

  it('gives students nothing to pick', () => {
    const groups = groupMessageAudienceCandidates(members, { senderId: 'student' });
    expect(groups).toEqual({
      staffIds: [],
      parents: [],
      tutors: [],
      students: [],
      namedPeople: [],
    });
  });

  it('has no staff option when no other staff are in the channel', () => {
    const groups = groupMessageAudienceCandidates(
      [
        { id: 'tutor', kind: 'educator' },
        { id: 'parent-a', kind: 'guardian' },
      ],
      { senderId: 'tutor' },
    );
    expect(groups.staffIds).toEqual([]);
  });
});

describe('isExactAudienceSelection', () => {
  it('matches the same ids in any order', () => {
    expect(isExactAudienceSelection(['b', 'a'], ['a', 'b'])).toBe(true);
    expect(isExactAudienceSelection(['a'], ['a', 'b'])).toBe(false);
    expect(isExactAudienceSelection([], [])).toBe(false);
  });
});

describe('getMessageAudienceGroupOptions', () => {
  it('names each reachable group, singular for one member', () => {
    const groups = groupMessageAudienceCandidates(
      [
        { id: 'staff', kind: 'staff' },
        { id: 'tutor', kind: 'educator' },
        { id: 'parent-a', kind: 'guardian' },
        { id: 'parent-b', kind: 'guardian' },
        { id: 'student', kind: 'child' },
      ],
      { senderId: 'staff' },
    );
    expect(getMessageAudienceGroupOptions(groups)).toEqual([
      { key: 'parents', label: 'Parents', ids: ['parent-a', 'parent-b'] },
      { key: 'tutors', label: 'Tutor', ids: ['tutor'] },
      { key: 'students', label: 'Student', ids: ['student'] },
    ]);
  });

  it('leaves out groups the sender cannot reach', () => {
    const groups = groupMessageAudienceCandidates(
      [
        { id: 'tutor', kind: 'educator' },
        { id: 'parent-a', kind: 'guardian' },
        { id: 'student', kind: 'child' },
      ],
      { senderId: 'parent-a' },
    );
    expect(getMessageAudienceGroupOptions(groups).map((option) => option.label)).toEqual([
      'Tutor',
    ]);
  });
});
