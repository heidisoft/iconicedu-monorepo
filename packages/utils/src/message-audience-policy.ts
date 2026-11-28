import type { MessageVisibilityVM } from '@iconicedu/shared-types';

/**
 * Safeguarding rules for restricted ("private") channel messages.
 *
 * The API enforces these rules; web and mobile use the same helpers only to
 * hide options the API would reject.
 *
 * | Sender  | May address privately               |
 * | ------- | ----------------------------------- |
 * | staff   | anyone                              |
 * | tutor   | staff, tutors, parents, students *  |
 * | parent  | staff, tutors                       |
 * | student | nobody (cannot start private chats) |
 *
 * * A student is only addressable together with a guardian, who is added to
 *   the audience automatically.
 */
export type MessageAudienceRole = 'staff' | 'tutor' | 'parent' | 'student' | 'other';

const ADDRESSABLE_ROLES: Record<MessageAudienceRole, ReadonlySet<MessageAudienceRole>> = {
  staff: new Set<MessageAudienceRole>(['staff', 'tutor', 'parent', 'student', 'other']),
  tutor: new Set<MessageAudienceRole>(['staff', 'tutor', 'parent', 'student']),
  parent: new Set<MessageAudienceRole>(['staff', 'tutor']),
  student: new Set<MessageAudienceRole>(),
  other: new Set<MessageAudienceRole>(),
};

/**
 * Maps a profile kind (plus org staff roles, which only the API can see) to a
 * safeguarding role. Owners and admins count as staff.
 */
export function resolveMessageAudienceRole(
  profileKind: string | null | undefined,
  options: { hasStaffRole?: boolean } = {},
): MessageAudienceRole {
  if (options.hasStaffRole || profileKind === 'staff') return 'staff';
  switch (profileKind) {
    case 'educator':
      return 'tutor';
    case 'guardian':
      return 'parent';
    case 'child':
      return 'student';
    default:
      return 'other';
  }
}

export function canInitiateRestrictedMessage(sender: MessageAudienceRole): boolean {
  return ADDRESSABLE_ROLES[sender].size > 0;
}

export function canAddressPrivately(
  sender: MessageAudienceRole,
  recipient: MessageAudienceRole,
): boolean {
  return ADDRESSABLE_ROLES[sender].has(recipient);
}

/**
 * Non-staff senders may only reach a student when at least one of the
 * student's guardians is also in the audience. Staff are exempt because every
 * restricted message is already open to staff review.
 */
export function requiresGuardianForStudentRecipients(
  sender: MessageAudienceRole,
): boolean {
  return sender !== 'staff';
}

/**
 * True when the viewer can see a restricted message only through staff review,
 * i.e. they are neither its sender nor in its audience. Such messages are
 * read-only: no replies, reactions, pins, or edits.
 */
export function isOutsideMessageAudience(input: {
  visibility: MessageVisibilityVM;
  senderProfileId?: string | null;
  viewerProfileId?: string | null;
}): boolean {
  const { visibility, senderProfileId, viewerProfileId } = input;
  if (!viewerProfileId || visibility.type === 'all') return false;
  if (viewerProfileId === senderProfileId) return false;
  switch (visibility.type) {
    case 'sender-only':
      return true;
    case 'recipient-only':
      return visibility.userId !== viewerProfileId;
    case 'specific-users':
      return !visibility.userIds.includes(viewerProfileId);
    default:
      return false;
  }
}
